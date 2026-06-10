"""
BOMOps アプリケーション設定
"""

from django.apps import AppConfig


class BomConfig(AppConfig):
    """BOM アプリケーション設定"""

    default_auto_field = "django.db.models.BigAutoField"
    name = "bom"
    verbose_name = "BOM管理"
