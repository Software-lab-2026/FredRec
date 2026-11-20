from typing import Any

_SPECIAL = {-1: None, -2: None, -
            3: float("nan"), -4: float("inf"), -5: float("-inf"), -6: -0.0}


class DevalueError(ValueError):
    pass


def unflatten(values: list[Any]) -> Any:
    if not isinstance(values, list) or not values:
        raise DevalueError("expected a non-empty list")
    done: dict[int, Any] = {}

    def at(index: int) -> Any:
        if not isinstance(index, int):
            raise DevalueError(f"bad reference {index!r}")
        if index in _SPECIAL:
            return _SPECIAL[index]
        if index in done:
            return done[index]
        if not 0 <= index < len(values):
            raise DevalueError(f"reference {index} out of range")
        value = values[index]
        if isinstance(value, dict):
            result: dict[str, Any] = {}
            done[index] = result  # set first, so references back to it resolve
            for key, ref in value.items():
                result[key] = at(ref)
            return result
        if isinstance(value, list):
            if value and isinstance(value[0], str):
                return _wrapped(index, value)
            result_list: list[Any] = []
            done[index] = result_list
            result_list.extend(at(ref) for ref in value)
            return result_list
        done[index] = value
        return value

    def _wrapped(index: int, value: list[Any]) -> Any:
        kind, rest = value[0], value[1:]
        if kind == "Date":
            done[index] = rest[0]  # kept as the ISO string
        elif kind == "Set":
            done[index] = [at(ref) for ref in rest]
        elif kind == "Map":
            done[index] = {str(at(k)): at(v)
                           for k, v in zip(rest[::2], rest[1::2], strict=True)}
        elif kind in ("BigInt", "RegExp", "URL"):
            done[index] = rest[0]
        else:
            raise DevalueError(f"unsupported type {kind!r}")
        return done[index]

    return at(0)


def page_data(response_json: dict[str, Any]) -> dict[str, Any]:
    if response_json.get("type") != "data":
        raise DevalueError(f"page answered {response_json.get('type')!r}")
    merged: dict[str, Any] = {}
    for node in response_json.get("nodes") or []:
        if not node or node.get("type") == "skip":
            continue
        if node.get("type") != "data":
            raise DevalueError(f"node answered {node.get('type')!r}")
        value = unflatten(node["data"])
        if isinstance(value, dict):
            merged.update(value)
    return merged
