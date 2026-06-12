"""
BOMOps カスタムモデルフィールド

SiteConfig の token / secret 系フィールドを暗号化保存するための
EncryptedTextField を提供する（CLAUDE.md §4.1）。
"""

import base64
import hashlib
from typing import Any

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings
from django.db import models


def _get_fernet() -> Fernet:
    """暗号化キーを取得する

    BOMOPS_ENCRYPTION_KEY が未設定の場合は SECRET_KEY から導出する。
    """
    key_source = settings.BOMOPS_ENCRYPTION_KEY or settings.SECRET_KEY
    digest = hashlib.sha256(key_source.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


class EncryptedTextField(models.TextField):
    """保存時に Fernet で暗号化し、読み出し時に復号する TextField

    DB上には暗号化済みトークン（gAAAA... 形式）のみが保存される。
    """

    def get_prep_value(self, value: Any) -> Any:
        value = super().get_prep_value(value)
        if value is None or value == "":
            return value
        return _get_fernet().encrypt(str(value).encode()).decode()

    def from_db_value(
        self, value: Any, expression: Any, connection: Any
    ) -> Any:
        if value is None or value == "":
            return value
        try:
            return _get_fernet().decrypt(value.encode()).decode()
        except InvalidToken:
            # 暗号化導入前の平文データはそのまま返す
            return value
