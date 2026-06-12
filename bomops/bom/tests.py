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
    DeployEvent,
    EquipmentRef,
    MaintenanceEvent,
    PartMaster,
    PartUnit,
    ProductBOM,
    ProductModel,
    SiteConfig,
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


class PartUnitHistoryAPITest(APITestCase):
    """部品使用履歴APIのテスト"""

    def setUp(self) -> None:
        """テストデータのセットアップ"""
        self.user = User.objects.create_user(
            username="testuser",
            password="testpass123",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        self.part_master = PartMaster.objects.create(
            part_code="CAM-456",
            name="USB Camera",
            category=PartMaster.Category.CAMERA,
        )
        self.part_unit = PartUnit.objects.create(
            part_master=self.part_master,
            serial_number="CAM-0001",
            purchase_date="2025-01-10",
            purchase_order_no="PO-001",
        )
        self.product_model = ProductModel.objects.create(
            code="BSTAND-V1.0", name="BAITEN STAND V1.0",
        )
        self.bss_set = BssSet.objects.create(
            set_code="BST-2025-0001", product_model=self.product_model,
        )

        now = timezone.now()
        # 搭載→取外し→保守イベントの履歴を作成
        BssSetComponent.objects.create(
            bss_set=self.bss_set,
            part_unit=self.part_unit,
            role="CAMERA1",
            mounted_at=now - timezone.timedelta(days=30),
            unmounted_at=now - timezone.timedelta(days=5),
        )
        MaintenanceEvent.objects.create(
            bss_set=self.bss_set,
            part_unit=self.part_unit,
            event_type=MaintenanceEvent.EventType.FAILURE,
            note="映像が映らない",
            occurred_at=now - timezone.timedelta(days=6),
        )

    def test_history_timeline(self) -> None:
        """使用履歴タイムラインの統合・並び順テスト"""
        url = reverse("bom:part-unit-history", kwargs={"pk": self.part_unit.pk})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["part_unit"]["serial_number"], "CAM-0001")

        kinds = [e["kind"] for e in response.data["timeline"]]
        # 時系列降順: 取外し(5日前) → 故障(6日前) → 搭載(30日前) → 購入(1/10)
        self.assertEqual(kinds, ["UNMOUNTED", "MAINTENANCE", "MOUNTED", "PURCHASED"])

        mounted = response.data["timeline"][2]
        self.assertEqual(mounted["set_code"], "BST-2025-0001")
        self.assertEqual(mounted["role"], "CAMERA1")

        maintenance = response.data["timeline"][1]
        self.assertEqual(maintenance["event_type"], "FAILURE")
        self.assertEqual(maintenance["note"], "映像が映らない")

        purchased = response.data["timeline"][3]
        self.assertEqual(purchased["purchase_order_no"], "PO-001")

    def test_history_empty(self) -> None:
        """履歴のない部品のタイムラインが空であることのテスト"""
        unit = PartUnit.objects.create(
            part_master=self.part_master,
            serial_number="CAM-9999",
        )
        url = reverse("bom:part-unit-history", kwargs={"pk": unit.pk})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["timeline"], [])


class HealthAPITest(APITestCase):
    """ヘルスチェックAPIのテスト"""

    def test_health_no_auth_required(self) -> None:
        """認証なしで200を返すことのテスト（接続状態検知用）"""
        url = reverse("bom:health")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "ok")

        response = self.client.head(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)


class DashboardSummaryAPITest(APITestCase):
    """ダッシュボードサマリーAPIのテスト"""

    def setUp(self) -> None:
        """テストデータのセットアップ"""
        self.user = User.objects.create_user(
            username="testuser",
            password="testpass123",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        pm = PartMaster.objects.create(
            part_code="PC-001", name="Mini PC", category=PartMaster.Category.PC,
        )
        cam = PartMaster.objects.create(
            part_code="CAM-001", name="Camera", category=PartMaster.Category.CAMERA,
        )
        PartUnit.objects.create(part_master=pm, serial_number="PC-1", status="IN_STOCK")
        PartUnit.objects.create(part_master=pm, serial_number="PC-2", status="ASSIGNED")
        PartUnit.objects.create(part_master=cam, serial_number="CAM-1", status="BROKEN")

        model = ProductModel.objects.create(code="M-1", name="Model")
        BssSet.objects.create(set_code="S-1", product_model=model, status="INSTALLED")
        BssSet.objects.create(set_code="S-2", product_model=model, status="ASSEMBLED")

        customer = Customer.objects.create(code="C-1", name="顧客A")
        CustomerSite.objects.create(
            customer=customer, name="拠点1", lifecycle_status="ACTIVE",
        )
        CustomerSite.objects.create(
            customer=customer, name="拠点2", lifecycle_status="PREPARING",
        )

    def test_summary_counts(self) -> None:
        """サマリー集計がDB実数と一致することのテスト"""
        url = reverse("bom:dashboard-summary")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data

        self.assertEqual(data["sets"]["total"], 2)
        self.assertEqual(data["sets"]["by_status"]["INSTALLED"], 1)
        self.assertEqual(data["sets"]["by_status"]["ASSEMBLED"], 1)

        self.assertEqual(data["part_units"]["total"], 3)
        self.assertEqual(data["part_units"]["by_status"]["IN_STOCK"], 1)
        self.assertEqual(data["part_units"]["by_status"]["BROKEN"], 1)
        self.assertEqual(data["part_units"]["by_category"]["PC"], 2)
        self.assertEqual(data["part_units"]["by_category"]["CAMERA"], 1)

        self.assertEqual(data["sites"]["total"], 2)
        self.assertEqual(data["sites"]["by_lifecycle_status"]["ACTIVE"], 1)

        self.assertEqual(data["customers"]["total"], 1)


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


class CustomerSiteLifecycleTest(TestCase):
    """顧客拠点ライフサイクル状態のテスト"""

    def setUp(self) -> None:
        """テストデータのセットアップ"""
        self.customer = Customer.objects.create(code="CUST-001", name="XX工場")
        self.site = CustomerSite.objects.create(
            customer=self.customer,
            name="本社食堂",
        )

    def test_default_lifecycle_status(self) -> None:
        """初期状態は準備中であることのテスト"""
        self.assertEqual(
            self.site.lifecycle_status,
            CustomerSite.LifecycleStatus.PREPARING,
        )

    def test_lifecycle_transition(self) -> None:
        """準備中→稼働中→撤退済の遷移テスト"""
        self.site.lifecycle_status = CustomerSite.LifecycleStatus.ACTIVE
        self.site.save()
        self.site.refresh_from_db()
        self.assertEqual(
            self.site.lifecycle_status, CustomerSite.LifecycleStatus.ACTIVE
        )

        self.site.lifecycle_status = CustomerSite.LifecycleStatus.WITHDRAWN
        self.site.save()
        self.site.refresh_from_db()
        self.assertEqual(
            self.site.lifecycle_status, CustomerSite.LifecycleStatus.WITHDRAWN
        )


class SiteConfigModelTest(TestCase):
    """拠点設定モデルのテスト"""

    def setUp(self) -> None:
        """テストデータのセットアップ"""
        self.customer = Customer.objects.create(code="CUST-001", name="XX工場")
        self.site = CustomerSite.objects.create(
            customer=self.customer,
            name="本社食堂",
        )
        self.config = SiteConfig.objects.create(
            customer_site=self.site,
            loyverse_account="loyverse@example.com",
            loyverse_token="loyverse_secret_token_12345",
            paypay_secret="paypay_secret_67890",
        )

    def test_one_to_one_relation(self) -> None:
        """CustomerSite と SiteConfig が1:1であることのテスト"""
        self.assertEqual(self.site.config, self.config)

        # 同一拠点への2つ目の設定作成は IntegrityError
        from django.db import IntegrityError

        with self.assertRaises(IntegrityError):
            SiteConfig.objects.create(customer_site=self.site)

    def test_secret_encrypted_at_rest(self) -> None:
        """秘匿フィールドがDB上で暗号化されていることのテスト"""
        from django.db import connection

        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT loyverse_token, loyverse_account FROM site_config WHERE id = %s",
                [self.config.id],
            )
            raw_token, raw_account = cursor.fetchone()

        # 秘匿フィールドは平文ではなくFernetトークンとして保存される
        self.assertNotEqual(raw_token, "loyverse_secret_token_12345")
        self.assertTrue(raw_token.startswith("gAAAA"))
        # 非秘匿フィールドは平文のまま
        self.assertEqual(raw_account, "loyverse@example.com")

    def test_secret_decrypted_on_read(self) -> None:
        """秘匿フィールドが読み出し時に復号されることのテスト"""
        config = SiteConfig.objects.get(pk=self.config.pk)
        self.assertEqual(config.loyverse_token, "loyverse_secret_token_12345")
        self.assertEqual(config.paypay_secret, "paypay_secret_67890")


class SiteConfigAPITest(APITestCase):
    """拠点設定APIのテスト"""

    def setUp(self) -> None:
        """テストデータとクライアントのセットアップ"""
        self.user = User.objects.create_user(
            username="testuser",
            password="testpass123",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        self.customer = Customer.objects.create(code="CUST-001", name="XX工場")
        self.site = CustomerSite.objects.create(
            customer=self.customer,
            name="本社食堂",
        )

    def test_create_site_config(self) -> None:
        """拠点設定作成テスト"""
        url = reverse("bom:site-config-list")
        data = {
            "customer_site": self.site.pk,
            "loyverse_account": "loyverse@example.com",
            "loyverse_token": "loyverse_secret_token_12345",
            "squ_token": "sq_secret_99999",
        }
        response = self.client.post(url, data)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(SiteConfig.objects.count(), 1)

    def test_secrets_masked_in_response(self) -> None:
        """秘匿フィールドがAPIレスポンスでマスクされることのテスト"""
        SiteConfig.objects.create(
            customer_site=self.site,
            loyverse_account="loyverse@example.com",
            loyverse_token="loyverse_secret_token_12345",
            squ_token="sq",
        )

        url = reverse("bom:site-config-list")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        result = response.data["results"][0]
        # 秘匿フィールド: 末尾4文字以外マスク
        self.assertEqual(result["loyverse_token"], "****2345")
        # 4文字以下は全マスク
        self.assertEqual(result["squ_token"], "****")
        # 未設定の秘匿フィールドは null のまま
        self.assertIsNone(result["paypay_secret"])
        # 非秘匿フィールドは平文
        self.assertEqual(result["loyverse_account"], "loyverse@example.com")


class MaintenanceEventAPITest(APITestCase):
    """保守イベントAPI（追記型）のテスト"""

    def setUp(self) -> None:
        """テストデータとクライアントのセットアップ"""
        self.user = User.objects.create_user(
            username="testuser",
            password="testpass123",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        self.product_model = ProductModel.objects.create(
            code="BSTAND-V1.0",
            name="BAITEN STAND V1.0",
        )
        self.bss_set = BssSet.objects.create(
            set_code="BST-2025-0001",
            product_model=self.product_model,
        )
        self.part_master = PartMaster.objects.create(
            part_code="CAM-456",
            name="USB Camera",
            category=PartMaster.Category.CAMERA,
        )
        self.part_unit = PartUnit.objects.create(
            part_master=self.part_master,
            serial_number="CAM-0002",
        )

    def test_create_maintenance_event(self) -> None:
        """保守イベント追記テスト"""
        url = reverse("bom:maintenance-event-list")
        data = {
            "bss_set": self.bss_set.pk,
            "part_unit": self.part_unit.pk,
            "event_type": "FAILURE",
            "note": "カメラ映像が映らない",
        }
        response = self.client.post(url, data)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["serial_number"], "CAM-0002")

    def test_history_is_append_only(self) -> None:
        """履歴が追記され上書きで消えないことのテスト"""
        url = reverse("bom:maintenance-event-list")
        self.client.post(url, {
            "bss_set": self.bss_set.pk,
            "part_unit": self.part_unit.pk,
            "event_type": "FAILURE",
        })
        self.client.post(url, {
            "bss_set": self.bss_set.pk,
            "part_unit": self.part_unit.pk,
            "event_type": "REPLACEMENT",
        })

        response = self.client.get(url, {"bss_set": self.bss_set.pk})
        self.assertEqual(response.data["count"], 2)

    def test_update_and_delete_not_allowed(self) -> None:
        """保守イベントの更新・削除が禁止されていることのテスト"""
        event = MaintenanceEvent.objects.create(
            bss_set=self.bss_set,
            event_type=MaintenanceEvent.EventType.INSPECTION,
        )
        url = reverse("bom:maintenance-event-detail", kwargs={"pk": event.pk})

        response = self.client.put(url, {"event_type": "FAILURE"})
        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

        response = self.client.patch(url, {"event_type": "FAILURE"})
        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertEqual(MaintenanceEvent.objects.count(), 1)


class DeployEventAPITest(APITestCase):
    """導入イベントAPI（追記型）のテスト"""

    def setUp(self) -> None:
        """テストデータとクライアントのセットアップ"""
        self.user = User.objects.create_user(
            username="testuser",
            password="testpass123",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        self.product_model = ProductModel.objects.create(
            code="BSTAND-V1.0",
            name="BAITEN STAND V1.0",
        )
        self.bss_set = BssSet.objects.create(
            set_code="BST-2025-0001",
            product_model=self.product_model,
        )

    def test_deploy_stages_recorded(self) -> None:
        """設置→開通→稼働のステージ履歴が記録されることのテスト"""
        url = reverse("bom:deploy-event-list")
        for stage in ["INSTALL", "ACTIVATION", "OPERATION"]:
            response = self.client.post(url, {
                "bss_set": self.bss_set.pk,
                "stage": stage,
            })
            self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        response = self.client.get(url, {"bss_set": self.bss_set.pk})
        self.assertEqual(response.data["count"], 3)

    def test_delete_not_allowed(self) -> None:
        """導入イベントの削除が禁止されていることのテスト"""
        event = DeployEvent.objects.create(
            bss_set=self.bss_set,
            stage=DeployEvent.Stage.INSTALL,
        )
        url = reverse("bom:deploy-event-detail", kwargs={"pk": event.pk})

        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertEqual(DeployEvent.objects.count(), 1)


class EquipmentRefAPITest(APITestCase):
    """機器管理参照APIのテスト"""

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
        )
        self.unit1 = PartUnit.objects.create(
            part_master=self.part_master,
            serial_number="PC-0001",
        )
        self.unit2 = PartUnit.objects.create(
            part_master=self.part_master,
            serial_number="PC-0002",
        )

    def test_page_size_param(self) -> None:
        """page_size クエリパラメータで件数を指定できることのテスト"""
        url = reverse("bom:part-unit-list")
        response = self.client.get(url, {"page_size": 1})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 1)

    def test_protected_delete_returns_409(self) -> None:
        """PROTECT参照のある部品実物の削除が409を返すことのテスト"""
        product_model = ProductModel.objects.create(code="M-1", name="Model")
        bss_set = BssSet.objects.create(set_code="S-1", product_model=product_model)
        BssSetComponent.objects.create(bss_set=bss_set, part_unit=self.unit1)

        url = reverse("bom:part-unit-detail", kwargs={"pk": self.unit1.pk})
        response = self.client.delete(url)

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertIn("削除できません", response.data["detail"])
        self.assertTrue(PartUnit.objects.filter(pk=self.unit1.pk).exists())

    def test_n_to_m_assignment(self) -> None:
        """機器と部品実物のN:M対応テスト"""
        url = reverse("bom:equipment-ref-list")
        response = self.client.post(url, {
            "external_id": "EQ-183e91a9-001",
            "name": "事務所PC",
            "part_units": [self.unit1.pk, self.unit2.pk],
        })

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            set(response.data["part_unit_serials"]),
            {"PC-0001", "PC-0002"},
        )

        # 1つの部品実物が複数の機器参照に紐づけられる（N:M）
        response = self.client.post(url, {
            "external_id": "EQ-183e91a9-002",
            "name": "予備機",
            "part_units": [self.unit1.pk],
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(self.unit1.equipment_refs.count(), 2)
