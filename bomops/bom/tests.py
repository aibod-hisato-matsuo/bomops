"""
BOMOps テスト

Django 標準の TestCase を使用したAPIテスト。
"""

from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from .models import (
    BssSet,
    BssSetComponent,
    BssSetConfig,
    Customer,
    CustomerSite,
    PartMaster,
    PartUnit,
    ProductBOM,
    ProductModel,
)


class PartMasterModelTest(TestCase):
    """部品マスタモデルのテスト"""

    def setUp(self) -> None:
        """テストデータのセットアップ"""
        self.part_master = PartMaster.objects.create(
            part_code="CAM-USB-001",
            name="USB Camera FullHD",
            category=PartMaster.Category.CAMERA,
            maker="Logicool",
            model_number="C920n",
            spec_json={"resolution": "1920x1080", "interface": "USB2.0"},
        )

    def test_part_master_creation(self) -> None:
        """部品マスタの作成テスト"""
        self.assertEqual(self.part_master.part_code, "CAM-USB-001")
        self.assertEqual(self.part_master.name, "USB Camera FullHD")
        self.assertEqual(self.part_master.category, PartMaster.Category.CAMERA)
        self.assertTrue(self.part_master.is_active)

    def test_part_master_str(self) -> None:
        """部品マスタの文字列表現テスト"""
        expected = "CAM-USB-001: USB Camera FullHD"
        self.assertEqual(str(self.part_master), expected)


class PartMasterAPITest(APITestCase):
    """部品マスタAPIのテスト"""

    def setUp(self) -> None:
        """テストデータとクライアントのセットアップ"""
        self.user = User.objects.create_user(
            username="testuser",
            password="testpass123",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        self.part_master = PartMaster.objects.create(
            part_code="PC-001",
            name="Mini PC",
            category=PartMaster.Category.PC,
            maker="Intel",
            model_number="NUC11",
        )

    def test_list_part_masters(self) -> None:
        """部品マスタ一覧取得テスト"""
        url = reverse("bom:part-master-list")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)

    def test_create_part_master(self) -> None:
        """部品マスタ作成テスト"""
        url = reverse("bom:part-master-list")
        data = {
            "part_code": "MON-001",
            "name": "24inch Monitor",
            "category": "MONITOR",
            "maker": "Dell",
            "model_number": "P2422H",
        }
        response = self.client.post(url, data)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(PartMaster.objects.count(), 2)
        self.assertEqual(response.data["part_code"], "MON-001")

    def test_retrieve_part_master(self) -> None:
        """部品マスタ詳細取得テスト"""
        url = reverse("bom:part-master-detail", kwargs={"pk": self.part_master.pk})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["part_code"], "PC-001")

    def test_filter_part_masters_by_category(self) -> None:
        """部品マスタのカテゴリフィルタテスト"""
        PartMaster.objects.create(
            part_code="CAM-001",
            name="Camera",
            category=PartMaster.Category.CAMERA,
        )

        url = reverse("bom:part-master-list")
        response = self.client.get(url, {"category": "PC"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["category"], "PC")


class BssSetCompositionAPITest(APITestCase):
    """BSSセット構成ビューAPIのテスト"""

    def setUp(self) -> None:
        """テストデータのセットアップ"""
        self.user = User.objects.create_user(
            username="testuser",
            password="testpass123",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        # 製品モデル作成
        self.product_model = ProductModel.objects.create(
            code="BSTAND-V1.0",
            name="BAITEN STAND V1.0",
        )

        # 部品マスタ作成
        self.pc_master = PartMaster.objects.create(
            part_code="PC-123",
            name="Mini PC",
            category=PartMaster.Category.PC,
        )
        self.cam_master = PartMaster.objects.create(
            part_code="CAM-456",
            name="USB Camera",
            category=PartMaster.Category.CAMERA,
        )

        # 部品実物作成
        self.pc_unit = PartUnit.objects.create(
            part_master=self.pc_master,
            serial_number="PC-0001",
            status=PartUnit.Status.ASSIGNED,
        )
        self.cam_unit = PartUnit.objects.create(
            part_master=self.cam_master,
            serial_number="CAM-0002",
            status=PartUnit.Status.ASSIGNED,
        )

        # BSSセット作成
        self.bss_set = BssSet.objects.create(
            set_code="BST-2025-0001",
            product_model=self.product_model,
            status=BssSet.Status.ASSEMBLED,
        )

        # 構成部品作成
        BssSetComponent.objects.create(
            bss_set=self.bss_set,
            part_unit=self.pc_unit,
            role="MAIN_PC",
            mounted_at=timezone.now(),
        )
        BssSetComponent.objects.create(
            bss_set=self.bss_set,
            part_unit=self.cam_unit,
            role="CAMERA1",
            mounted_at=timezone.now(),
        )

    def test_get_composition(self) -> None:
        """セット構成ビュー取得テスト"""
        url = reverse(
            "bom:bss-set-composition",
            kwargs={"pk": self.bss_set.pk},
        )
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["set_id"], self.bss_set.id)
        self.assertEqual(response.data["set_code"], "BST-2025-0001")
        self.assertEqual(response.data["product_model"], "BSTAND-V1.0")
        self.assertEqual(len(response.data["components"]), 2)

        # 構成部品の内容確認
        roles = {comp["role"] for comp in response.data["components"]}
        self.assertIn("MAIN_PC", roles)
        self.assertIn("CAMERA1", roles)


class LookupBySerialAPITest(APITestCase):
    """シリアル番号逆引きAPIのテスト"""

    def setUp(self) -> None:
        """テストデータのセットアップ"""
        self.user = User.objects.create_user(
            username="testuser",
            password="testpass123",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        # 顧客・拠点作成
        self.customer = Customer.objects.create(
            code="CUST-001",
            name="XX工場",
        )
        self.site = CustomerSite.objects.create(
            customer=self.customer,
            name="本社食堂",
        )

        # 製品モデル作成
        self.product_model = ProductModel.objects.create(
            code="BSTAND-V1.0",
            name="BAITEN STAND V1.0",
        )

        # 部品マスタ・実物作成
        self.cam_master = PartMaster.objects.create(
            part_code="CAM-456",
            name="USB Camera FullHD",
            category=PartMaster.Category.CAMERA,
        )
        self.cam_unit = PartUnit.objects.create(
            part_master=self.cam_master,
            serial_number="CAM-0002",
            status=PartUnit.Status.ASSIGNED,
        )

        # BSSセット作成（設置済み）
        self.bss_set = BssSet.objects.create(
            set_code="BST-2025-0001",
            product_model=self.product_model,
            status=BssSet.Status.INSTALLED,
            customer_site=self.site,
            installed_at=timezone.now(),
        )

        # 構成部品作成
        BssSetComponent.objects.create(
            bss_set=self.bss_set,
            part_unit=self.cam_unit,
            role="CAMERA1",
            mounted_at=timezone.now(),
        )

    def test_lookup_by_serial_found(self) -> None:
        """シリアル番号逆引き（発見）テスト"""
        url = reverse("bom:lookup-by-serial")
        response = self.client.get(url, {"serial_number": "CAM-0002"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["serial_number"], "CAM-0002")
        self.assertEqual(response.data["part_master"], "USB Camera FullHD")
        self.assertIsNotNone(response.data["current_set"])
        self.assertEqual(response.data["current_set"]["set_code"], "BST-2025-0001")
        self.assertEqual(response.data["current_set"]["status"], "INSTALLED")
        self.assertIsNotNone(response.data["current_site"])
        self.assertEqual(response.data["current_site"]["customer"], "XX工場")
        self.assertEqual(response.data["current_site"]["site"], "本社食堂")

    def test_lookup_by_serial_not_found(self) -> None:
        """シリアル番号逆引き（未発見）テスト"""
        url = reverse("bom:lookup-by-serial")
        response = self.client.get(url, {"serial_number": "NOT-EXIST"})

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_lookup_by_serial_missing_param(self) -> None:
        """シリアル番号逆引き（パラメータ欠如）テスト"""
        url = reverse("bom:lookup-by-serial")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class BssSetConfigAPITest(APITestCase):
    """BSSセット設定APIのテスト"""

    def setUp(self) -> None:
        """テストデータのセットアップ"""
        self.user = User.objects.create_user(
            username="testuser",
            password="testpass123",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        # 製品モデル・BSSセット作成
        self.product_model = ProductModel.objects.create(
            code="BSTAND-V1.0",
            name="BAITEN STAND V1.0",
        )
        self.bss_set = BssSet.objects.create(
            set_code="BST-2025-0001",
            product_model=self.product_model,
        )

        # 設定作成
        BssSetConfig.objects.create(
            bss_set=self.bss_set,
            config_group="PAYPAY",
            key="merchant_id",
            value="12345678",
            is_secret=False,
        )
        BssSetConfig.objects.create(
            bss_set=self.bss_set,
            config_group="PAYPAY",
            key="api_key",
            value="secret_api_key_12345",
            is_secret=True,
        )

    def test_get_effective_configs(self) -> None:
        """有効なコンフィグ一覧取得テスト"""
        url = reverse(
            "bom:bss-set-effective-configs",
            kwargs={"pk": self.bss_set.pk},
        )
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

        # 秘匿情報はマスクされていることを確認
        for config in response.data:
            if config["key"] == "api_key":
                self.assertEqual(config["value"], "****")
                self.assertTrue(config["is_secret"])
            elif config["key"] == "merchant_id":
                self.assertEqual(config["value"], "12345678")
                self.assertFalse(config["is_secret"])
