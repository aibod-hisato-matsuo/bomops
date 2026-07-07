# PartMaster.category を固定 choices からカテゴリマスタ（PartCategory）FKへ移行する

import django.db.models.deletion
from django.db import migrations, models

# 旧 enum 値 → カテゴリ名（表示ラベルをそのままマスタ名として採用）
CODE_TO_NAME = {
    "PC": "PC",
    "MONITOR": "モニター",
    "CAMERA": "カメラ",
    "BARCODE": "バーコードリーダー",
    "PAYMENT": "決済端末",
    "CABLE": "ケーブル",
    "OTHER": "その他",
}


def seed_and_link(apps, schema_editor):
    PartCategory = apps.get_model("bom", "PartCategory")
    PartMaster = apps.get_model("bom", "PartMaster")

    categories = {}
    for code, name in CODE_TO_NAME.items():
        categories[code], _ = PartCategory.objects.get_or_create(name=name)

    other = categories["OTHER"]
    for part in PartMaster.objects.all():
        part.category_fk = categories.get(part.category, other)
        part.save(update_fields=["category_fk"])


def unlink(apps, schema_editor):
    # 逆方向は列削除で消えるため何もしない
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("bom", "0002_partmaster_part_group"),
    ]

    operations = [
        migrations.CreateModel(
            name="PartCategory",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="作成日時")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="更新日時")),
                ("name", models.CharField(max_length=100, unique=True, verbose_name="カテゴリ名")),
            ],
            options={
                "verbose_name": "部品カテゴリ",
                "verbose_name_plural": "部品カテゴリ",
                "db_table": "part_category",
                "ordering": ["id"],
            },
        ),
        migrations.AddField(
            model_name="partmaster",
            name="category_fk",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="parts",
                to="bom.partcategory",
                verbose_name="カテゴリ",
            ),
        ),
        migrations.RunPython(seed_and_link, unlink),
        migrations.RemoveField(model_name="partmaster", name="category"),
        migrations.RenameField(model_name="partmaster", old_name="category_fk", new_name="category"),
        migrations.AlterField(
            model_name="partmaster",
            name="category",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name="parts",
                to="bom.partcategory",
                verbose_name="カテゴリ",
            ),
        ),
    ]
