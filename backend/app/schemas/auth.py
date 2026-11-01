import uuid
from typing import Annotated
from pydantic import AfterValidator, BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel
from app.core.validation import clean_email, clean_password, clean_username
from app.models.base import Role

PasswordAttempt = Annotated[str, Field(max_length=50)]
NewPassword = Annotated[str, AfterValidator(clean_password)]


class ApiModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class SignupIn(ApiModel):
    username: Annotated[str, AfterValidator(clean_username)]
    email: Annotated[str, AfterValidator(clean_email)]
    password: NewPassword


class LoginIn(ApiModel):
    username: Annotated[str, Field(max_length=20)]
    password: PasswordAttempt


class ChangePasswordIn(ApiModel):
    current_password: PasswordAttempt
    new_password: NewPassword


class UserOut(ApiModel):
    id: uuid.UUID
    username: str
    email: str
    role: Role
    domain_ids: list[uuid.UUID]
    must_change_password: bool


class AuthOut(ApiModel):
    access_token: str
    user: UserOut
