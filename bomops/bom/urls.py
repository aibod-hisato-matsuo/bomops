"""
BOMOps API URLルーティング定義

/api/v1/ 配下のルーティングを定義。
"""

from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
    TokenVerifyView,
)

from . import views

# DRF Router設定
router = DefaultRouter()
router.register(r"part-masters", views.PartMasterViewSet, basename="part-master")
router.register(r"part-units", views.PartUnitViewSet, basename="part-unit")
router.register(r"product-models", views.ProductModelViewSet, basename="product-model")
router.register(r"product-boms", views.ProductBOMViewSet, basename="product-bom")
router.register(r"customers", views.CustomerViewSet, basename="customer")
router.register(r"customer-sites", views.CustomerSiteViewSet, basename="customer-site")
router.register(r"bss-sets", views.BssSetViewSet, basename="bss-set")
router.register(
    r"bss-set-components", views.BssSetComponentViewSet, basename="bss-set-component"
)
router.register(r"bss-set-configs", views.BssSetConfigViewSet, basename="bss-set-config")

app_name = "bom"

urlpatterns = [
    # JWT認証エンドポイント
    path("auth/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("auth/token/verify/", TokenVerifyView.as_view(), name="token_verify"),
    # カスタムAPI
    path("lookup/by-serial/", views.lookup_by_serial, name="lookup-by-serial"),
    # ViewSet Router
    path("", include(router.urls)),
]
