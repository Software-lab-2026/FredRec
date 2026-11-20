import asyncio
import email.utils
import logging
import time
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from urllib.parse import urljoin, urlsplit
from urllib.robotparser import RobotFileParser

import httpx

log = logging.getLogger(__name__)

ROBOT_NAME = "FredRecBot"
MAX_RETRY_WAIT_SECONDS = 60
MAX_REDIRECTS = 5
MAX_PAGE_BYTES = 10 * 1024 * 1024


class FetchError(Exception):
    """A page couldn't be fetched (after retries), or robots.txt doesn't allow it."""


class Blocked(FetchError):
    """robots.txt asks robots like ours not to fetch this page."""


def user_agent(contact_email: str = "") -> str:
    contact = f"; {contact_email}" if contact_email else ""
    return f"{ROBOT_NAME}/0.1 (+educational project indexing free CS learning resources{contact})"


def _retry_after(value: str | None) -> float | None:
    if not value:
        return None
    if value.strip().isdigit():
        return float(value)
    try:
        when = email.utils.parsedate_to_datetime(value)
    except (TypeError, ValueError):
        return None
    return max(0.0, (when - datetime.now(UTC)).total_seconds())


class PoliteFetcher:
    def __init__(
        self,
        client: httpx.AsyncClient,
        *,
        delay: float = 1.0,
        retries: int = 3,
        clock: Callable[[], float] = time.monotonic,
        sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
    ):
        self.client = client
        self.delay = delay
        self.retries = retries
        self._clock = clock
        self._sleep = sleep
        self._robots: dict[str, RobotFileParser] = {}
        self._last_request: dict[str, float] = {}
        self.pages_fetched = 0

    async def _wait_turn(self, origin: str) -> None:
        gap = self.delay
        robots = self._robots.get(origin)
        if robots is not None and (crawl_delay := robots.crawl_delay(ROBOT_NAME)):
            gap = max(gap, float(crawl_delay))
        last = self._last_request.get(origin)
        if last is not None and (wait := gap - (self._clock() - last)) > 0:
            await self._sleep(wait)
        self._last_request[origin] = self._clock()

    async def _robots_for(self, origin: str) -> RobotFileParser:
        if origin in self._robots:
            return self._robots[origin]
        parser = RobotFileParser()
        await self._wait_turn(origin)
        try:
            response = await self.client.get(f"{origin}/robots.txt", follow_redirects=True)
        except httpx.HTTPError:
            parser.disallow_all = True
        else:
            self.pages_fetched += 1
            if response.status_code >= 500:
                parser.disallow_all = True
            elif response.status_code >= 400:
                parser.allow_all = True
            else:
                parser.parse(response.text.splitlines())
        self._robots[origin] = parser
        return parser

    async def get(self, url: str) -> httpx.Response:
        for _ in range(MAX_REDIRECTS + 1):
            response = await self._get_once(url)
            if response.is_redirect and (location := response.headers.get("Location")):
                url = urljoin(url, location)
                continue
            if response.is_redirect:
                raise FetchError(f"{url}: redirect without a location")
            return response
        raise FetchError(f"{url}: too many redirects")

    async def _get_once(self, url: str) -> httpx.Response:
        parts = urlsplit(url)
        if parts.scheme not in ("http", "https") or not parts.netloc:
            raise FetchError(f"{url}: not a web address")
        origin = f"{parts.scheme}://{parts.netloc}"
        if not (await self._robots_for(origin)).can_fetch(ROBOT_NAME, url):
            raise Blocked(f"{url}: not allowed by robots.txt")

        backoff = 2.0
        for attempt in range(self.retries + 1):
            await self._wait_turn(origin)
            try:
                response = await self.client.get(url, follow_redirects=False)
            except httpx.HTTPError as e:
                if attempt == self.retries:
                    raise FetchError(f"{url}: {type(e).__name__}") from e
                await self._sleep(backoff)
                backoff *= 2
                continue
            self.pages_fetched += 1
            if response.status_code == 429 or response.status_code >= 500:
                if attempt == self.retries:
                    raise FetchError(f"{url}: HTTP {response.status_code}")
                wait = _retry_after(response.headers.get("Retry-After"))
                await self._sleep(min(wait if wait is not None else backoff, MAX_RETRY_WAIT_SECONDS))
                backoff *= 2
                continue
            if response.status_code >= 400:
                raise FetchError(f"{url}: HTTP {response.status_code}")
            if response.is_redirect:
                return response
            if len(response.content) > MAX_PAGE_BYTES:
                raise FetchError(f"{url}: page too large")
            return response
        raise FetchError(f"{url}: gave up")

    async def text(self, url: str) -> str:
        return (await self.get(url)).text

    async def json(self, url: str):
        try:
            return (await self.get(url)).json()
        except ValueError as e:
            raise FetchError(f"{url}: not valid JSON") from e
