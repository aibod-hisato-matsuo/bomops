"""
BOMOps API 例外ハンドラ

on_delete=PROTECT による削除拒否（ProtectedError）を 500 ではなく
409 Conflict + 人間可読なメッセージで返す。
"""

from typing import Any

from django.db.models.deletion import ProtectedError
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler


def bomops_exception_handler(exc: Exception, context: dict[str, Any]) -> Response | None:
    response = exception_handler(exc, context)
    if response is None and isinstance(exc, ProtectedError):
        return Response(
            {"detail": "他のレコードから参照されているため削除できません"},
            status=status.HTTP_409_CONFLICT,
        )
    return response
