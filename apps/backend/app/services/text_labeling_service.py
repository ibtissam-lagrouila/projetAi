import io
import math
import time
from typing import Any, Dict, List, Optional
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.dataset import Dataset
from app.models.dataset_version import DatasetVersion
from app.services.parquet_service import parquet_service


class TextLabelingService:
    def get_labeling_data(
        self,
        dataset_id: str,
        queue_id: str = "unlabeled",
        item_index: int = 0,
        db: Session = None
    ) -> Dict[str, Any]:
        dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
        if not dataset:
            raise HTTPException(status_code=404, detail="Dataset introuvable")

        versions = (
            db.query(DatasetVersion)
            .filter(DatasetVersion.dataset_id == dataset.id)
            .order_by(DatasetVersion.created_at.desc())
            .all()
        )
        if not versions:
            raise HTTPException(status_code=404, detail="No version found for this dataset")

        name = dataset.name.lower()
        if "ticket" in name or "support" in name:
            return self._get_template_data(dataset, len(versions), queue_id, item_index)
        else:
            return self._get_dynamic_data(dataset, len(versions), versions[0], queue_id, item_index)

    def _get_template_data(
        self,
        dataset: Dataset,
        v_count: int,
        queue_id: str,
        item_index: int
    ) -> Dict[str, Any]:
        output_v = "v4"

        # Mock items for different queues
        candidates_map = {
            "unlabeled": [
                {
                    "ticket_id": "#52018",
                    "language": "DARIJA",
                    "meta": "email · 02 Nov · part 1 of 1",
                    "text_raw": "Salam, khlsst 2 mrat w ba9i ma tfat lia l facture, 3ytouli f [PHONE] 3afak",
                    "tokens": [
                        {"text": "Salam, ", "highlight": False},
                        {"text": "khlsst 2 mrat", "highlight": True},
                        {"text": " w ba9i ma tfat lia ", "highlight": False},
                        {"text": "l facture", "highlight": True},
                        {"text": ", 3ytouli f [PHONE] 3afak", "highlight": False},
                    ],
                    "meaning_en": '"Hello, I paid twice and the invoice still isn\'t settled, please call me at [PHONE]."',
                    "meaning_sub": "Blue = words the model relied on. [PHONE] stays masked: annotators never see personal data.",
                    "labels": [
                        {"id": 1, "name": "billing", "confidence": 0.81, "selected": True},
                        {"id": 2, "name": "delivery"},
                        {"id": 3, "name": "refund", "confidence": 0.14},
                        {"id": 4, "name": "account"},
                        {"id": 5, "name": "technical"},
                        {"id": 6, "name": "complaint"},
                        {"id": 7, "name": "other"},
                    ],
                    "model_suggestions": [
                        {"label": "billing", "confidence": 0.81},
                        {"label": "refund", "confidence": 0.14},
                    ],
                    "similar_tickets": [
                        {"text": "charged twice this month", "label": "BILLING"},
                        {"text": "bghit nrj3 flous dyali", "label": "REFUND"},
                        {"text": "facture ghalta f lmontant", "label": "BILLING"},
                    ],
                    "definition_title": "DEFINITION · BILLING VS REFUND",
                    "definition_text": "billing: the invoice or the payment is wrong. refund: the customer asks for money back. Asks both? Choose refund.",
                    "this_ticket_meta": {
                        "why_in_queue": "no label",
                        "split": "train",
                        "paraphrases": "2 · inherit this label",
                    },
                },
                {
                    "ticket_id": "#52019",
                    "language": "FR",
                    "meta": "web_form · 02 Nov · part 1 of 1",
                    "text_raw": "Hello, my package has still not arrived at the pickup point since Monday [DATE].",
                    "tokens": [
                        {"text": "Bonjour, mon ", "highlight": False},
                        {"text": "package still not arrived", "highlight": True},
                        {"text": " au point relais depuis lundi [DATE].", "highlight": False},
                    ],
                    "meaning_en": '"Hello, my parcel still hasn\'t arrived at the relay point since Monday."',
                    "meaning_sub": "Blue = words the model relied on. [DATE] stays masked: annotators never see personal data.",
                    "labels": [
                        {"id": 1, "name": "billing"},
                        {"id": 2, "name": "delivery", "confidence": 0.92, "selected": True},
                        {"id": 3, "name": "refund"},
                        {"id": 4, "name": "account"},
                        {"id": 5, "name": "technical"},
                        {"id": 6, "name": "complaint", "confidence": 0.06},
                        {"id": 7, "name": "other"},
                    ],
                    "model_suggestions": [
                        {"label": "delivery", "confidence": 0.92},
                        {"label": "complaint", "confidence": 0.06},
                    ],
                    "similar_tickets": [
                        {"text": "colis en retard de 4 jours", "label": "DELIVERY"},
                        {"text": "pickup location closed without notice", "label": "DELIVERY"},
                        {"text": "delivery never received", "label": "DELIVERY"},
                    ],
                    "definition_title": "DEFINITION · DELIVERY VS COMPLAINT",
                    "definition_text": "delivery: question about tracking, carrier or delay. complaint: customer expressing anger or dissatisfaction.",
                    "this_ticket_meta": {
                        "why_in_queue": "no label",
                        "split": "train",
                        "paraphrases": "1 · inherit this label",
                    },
                },
            ],
            "suspected_errors": [
                {
                    "ticket_id": "#38102",
                    "language": "FR",
                    "meta": "chat · 03 Nov · part 1 of 1",
                    "text_raw": "I was charged for a subscription I never signed up for, refund my money.",
                    "tokens": [
                        {"text": "I was ", "highlight": False},
                        {"text": "charged for a subscription", "highlight": True},
                        {"text": " que je n'ai jamais souscrit, ", "highlight": False},
                        {"text": "refund my money", "highlight": True},
                        {"text": ".", "highlight": False},
                    ],
                    "meaning_en": '"I was charged for a subscription I never ordered, refund my money."',
                    "meaning_sub": "Annotated billing originally, but model is 94% sure this is refund.",
                    "labels": [
                        {"id": 1, "name": "billing", "confidence": 0.05},
                        {"id": 2, "name": "delivery"},
                        {"id": 3, "name": "refund", "confidence": 0.94, "selected": True},
                        {"id": 4, "name": "account"},
                        {"id": 5, "name": "technical"},
                        {"id": 6, "name": "complaint"},
                        {"id": 7, "name": "other"},
                    ],
                    "model_suggestions": [
                        {"label": "refund", "confidence": 0.94},
                        {"label": "billing", "confidence": 0.05},
                    ],
                    "similar_tickets": [
                        {"text": "refund requested after debit", "label": "REFUND"},
                        {"text": "I want to be refunded immediately", "label": "REFUND"},
                    ],
                    "definition_title": "DEFINITION · BILLING VS REFUND",
                    "definition_text": "billing: invoice issues. refund: explicit money-back demand.",
                    "this_ticket_meta": {
                        "why_in_queue": "suspected error (model disagrees ≥ 0.9)",
                        "split": "train",
                        "paraphrases": "3 · inherit this label",
                    },
                }
            ],
            "low_confidence": [
                {
                    "ticket_id": "#44199",
                    "language": "EN",
                    "meta": "email · 03 Nov · part 1 of 1",
                    "text_raw": "My account shows invoice failed but items were shipped already.",
                    "tokens": [
                        {"text": "My account shows ", "highlight": False},
                        {"text": "invoice failed", "highlight": True},
                        {"text": " but items were ", "highlight": False},
                        {"text": "shipped already", "highlight": True},
                        {"text": ".", "highlight": False},
                    ],
                    "meaning_en": '"My account shows invoice failed but items were shipped already."',
                    "meaning_sub": "Model hesitates between billing (0.49) and delivery (0.47).",
                    "labels": [
                        {"id": 1, "name": "billing", "confidence": 0.49, "selected": True},
                        {"id": 2, "name": "delivery", "confidence": 0.47},
                        {"id": 3, "name": "refund"},
                        {"id": 4, "name": "account"},
                        {"id": 5, "name": "technical"},
                        {"id": 6, "name": "complaint"},
                        {"id": 7, "name": "other"},
                    ],
                    "model_suggestions": [
                        {"label": "billing", "confidence": 0.49},
                        {"label": "delivery", "confidence": 0.47},
                    ],
                    "similar_tickets": [
                        {"text": "invoice error on shipped order", "label": "BILLING"},
                    ],
                    "definition_title": "DEFINITION · BILLING VS DELIVERY",
                    "definition_text": "Hesitation case feeding active learning.",
                    "this_ticket_meta": {
                        "why_in_queue": "low confidence (uncertain prediction)",
                        "split": "train",
                        "paraphrases": "0",
                    },
                }
            ],
            "to_review": [
                {
                    "ticket_id": "#19022",
                    "language": "AR",
                    "meta": "chat · 04 Nov · part 1 of 1",
                    "text_raw": "أريد تغيير كلمة المرور لحسابي لأنني نسيتها [EMAIL]",
                    "tokens": [
                        {"text": "أريد ", "highlight": False},
                        {"text": "تغيير كلمة المرور لحسابي", "highlight": True},
                        {"text": " لأنني نسيتها [EMAIL]", "highlight": False},
                    ],
                    "meaning_en": '"I want to reset my account password because I forgot it."',
                    "meaning_sub": "Double annotation conflict or peer review queue.",
                    "labels": [
                        {"id": 1, "name": "billing"},
                        {"id": 2, "name": "delivery"},
                        {"id": 3, "name": "refund"},
                        {"id": 4, "name": "account", "confidence": 0.96, "selected": True},
                        {"id": 5, "name": "technical"},
                        {"id": 6, "name": "complaint"},
                        {"id": 7, "name": "other"},
                    ],
                    "model_suggestions": [
                        {"label": "account", "confidence": 0.96},
                    ],
                    "similar_tickets": [
                        {"text": "reset password link not working", "label": "ACCOUNT"},
                    ],
                    "definition_title": "DEFINITION · ACCOUNT",
                    "definition_text": "Login, credentials, profile information.",
                    "this_ticket_meta": {
                        "why_in_queue": "to review by senior annotator",
                        "split": "train",
                        "paraphrases": "1",
                    },
                }
            ],
        }

        active_list = candidates_map.get(queue_id, candidates_map["unlabeled"])
        safe_idx = item_index % len(active_list)
        candidate = active_list[safe_idx]

        total_in_queue = 3240 if queue_id == "unlabeled" else (418 if queue_id == "suspected_errors" else (611 if queue_id == "low_confidence" else 120))
        current_num = 521 + safe_idx if queue_id == "unlabeled" else (1 + safe_idx)

        return {
            "dataset_id": str(dataset.id),
            "dataset_name": dataset.name,
            "display_title": dataset.name,
            "breadcrumb": "DATASET · V3 → V4 DRAFT · TEXT CLASSIFICATION · 7 LABELS",
            "kpis": {
                "to_label": "3,240",
                "to_label_sub": "new tickets since v3",
                "suspected_errors": "418",
                "suspected_errors_sub": "model disagrees ≥ 0.9",
                "done_today": "520",
                "done_today_sub": "2 annotators · 1 reviewer",
                "output": output_v,
                "output_sub": "v3 kept as is",
            },
            "gauge": {
                "coverage_before": 94,
                "coverage_after": 100,
            },
            "queues": [
                {
                    "id": "unlabeled",
                    "title": "UNLABELED",
                    "count": "3,240",
                    "desc": "Pre-labeled by ticket-cls-v3 · about 3 h at current pace",
                    "footer_done": "520 done",
                    "progress_pct": 16,
                    "btn_label": "Continue",
                    "active": queue_id == "unlabeled",
                },
                {
                    "id": "suspected_errors",
                    "title": "SUSPECTED ERRORS",
                    "count": "418",
                    "desc": "Labeled billing, model is sure it is refund · and similar cases",
                    "footer_done": "0 done",
                    "progress_pct": 0,
                    "btn_label": "Start",
                    "active": queue_id == "suspected_errors",
                },
                {
                    "id": "low_confidence",
                    "title": "LOW CONFIDENCE",
                    "count": "611",
                    "desc": "Model hesitates between billing and refund · feeds 07 Active learning",
                    "footer_done": "49 done",
                    "progress_pct": 8,
                    "btn_label": "Start",
                    "active": queue_id == "low_confidence",
                },
                {
                    "id": "to_review",
                    "title": "TO REVIEW",
                    "count": "120",
                    "desc": "Labels waiting for a reviewer · list of 30 to accept fast",
                    "footer_done": "Reviewer only",
                    "progress_pct": 0,
                    "btn_label": "Review",
                    "active": queue_id == "to_review",
                },
            ],
            "queue_config": {
                "task": "One label per ticket",
                "pre_labeling": "ticket-cls-v3 · show top 3",
                "language": "All · fr · ar · darija · en",
                "double_annotation": "10% of tickets",
            },
            "workspace": {
                "ticket_counter": f"{queue_id.upper()} · {candidate['ticket_id']} · {current_num} / {total_in_queue:,}",
                "ticket_id": candidate["ticket_id"],
                "language": candidate["language"],
                "meta": candidate["meta"],
                "text_raw": candidate["text_raw"],
                "tokens": candidate["tokens"],
                "meaning_en": candidate["meaning_en"],
                "meaning_sub": candidate["meaning_sub"],
                "labels": candidate["labels"],
                "model_suggestions": candidate["model_suggestions"],
                "similar_tickets": candidate["similar_tickets"],
                "definition_title": candidate["definition_title"],
                "definition_text": candidate["definition_text"],
                "this_ticket_meta": candidate["this_ticket_meta"],
            },
            "label_checks": [
                {"id": "c1", "title": "Same text, different labels", "desc": "after trimming spaces and case", "count": 14},
                {"id": "c2", "title": "Very short texts labeled with confidence", "desc": 'under 3 words, e.g. "salam"', "count": 22},
                {"id": "c3", "title": '"other" used too often', "desc": "over 30% for one annotator", "count": 1},
                {"id": "c4", "title": "Chunks of one ticket labeled differently", "desc": "long tickets split in Cleaning", "count": 6},
            ],
            "team": [
                {"name": "[ANNOTATOR 1]", "tickets_per_h": 260, "accepts_ai": "74%", "agreement": "0.88"},
                {"name": "[ANNOTATOR 2]", "tickets_per_h": 240, "accepts_ai": "69%", "agreement": "0.84"},
            ],
            "guardrails": [
                {"title": "Test set labeled by humans only", "subtitle": "No suggestion shown · reviewed twice", "checked": True},
                {"title": "Personal data stays masked", "subtitle": "[PHONE], [EMAIL], [NAME] never revealed", "checked": True},
                {"title": "Paraphrases follow their parent", "subtitle": "Never queued · label copied on save", "checked": True},
                {"title": "Label list changes = new version", "subtitle": "Rename, merge or add a label", "checked": True},
                {"title": "Audit on every label", "subtitle": "Who, when, suggestion accepted or chosen", "checked": True},
                {"title": '"other" is still small', "subtitle": "740 real tickets · collect more", "checked": False, "is_warning": True},
            ],
            "action_banner": {
                "summary": "520 labeled · 61 corrected · 104 paraphrases updated",
                "detail": "Saved as v4 with the label log attached; the augmentation recipe can replay on it",
                "target_version": output_v,
            },
        }

    def _get_dynamic_data(
        self,
        dataset: Dataset,
        v_count: int,
        latest_version: DatasetVersion,
        queue_id: str,
        item_index: int
    ) -> Dict[str, Any]:
        total_rows = latest_version.row_count or 100
        classes = ["positive", "neutral", "negative"]
        sample_texts = [
            "Customer service responded quickly to my inquiry regarding the order.",
            "Unable to access my account after several attempts today.",
            "Product received in good condition but two days later than scheduled.",
        ]

        storage_path = getattr(latest_version, "storage_path", None)
        if storage_path:
            try:
                table = parquet_service.read_parquet(storage_path)
                total_rows = max(10, table.num_rows)
                # extract classes
                for col in ["label", "class", "target", "category", "sentiment"]:
                    if col in table.column_names:
                        vals = [str(x) for x in table[col].to_pylist() if x is not None]
                        uniq = list(dict.fromkeys(vals))
                        if uniq:
                            classes = uniq[:7]
                        break
                # extract sample texts
                for col in ["text", "document", "review", "content", "message", "body", "ticket"]:
                    if col in table.column_names:
                        raws = [str(x) for x in table[col].to_pylist() if x is not None and len(str(x).strip()) > 10]
                        if raws:
                            sample_texts = raws[:10]
                        break
            except Exception:
                pass

        unlabeled_cnt = max(5, int(round(total_rows * 0.25)))
        suspected_cnt = max(1, int(round(total_rows * 0.04)))
        low_conf_cnt = max(2, int(round(total_rows * 0.06)))
        review_cnt = max(1, int(round(total_rows * 0.02)))
        done_cnt = max(3, int(round(total_rows * 0.12)))

        output_v = f"v{v_count + 1}"

        # Build queue-specific candidates for dynamic text datasets
        queue_content = {
            "unlabeled": {
                "text": sample_texts[item_index % len(sample_texts)],
                "ticket_id": f"#DOC_{item_index + 101}",
                "why": "unlabeled document · ready for initial annotation",
                "total": unlabeled_cnt,
                "banner": None,
                "suggestions": [
                    {"label": classes[0], "confidence": 0.84},
                    {"label": classes[1] if len(classes) > 1 else classes[0], "confidence": 0.12},
                ],
                "meaning_sub": "Blue = salient words according to model attribution. PII masked.",
                "highlight_phrase": None,
            },
            "suspected_errors": {
                "text": "The transaction failed during final payment, but money was debited from my account with zero order confirmation.",
                "ticket_id": f"#DOC_ERR_{item_index + 201}",
                "why": "model disagrees ≥ 0.9 with current human label",
                "total": suspected_cnt,
                "banner": {
                    "type": "error",
                    "title": "SUSPECTED LABEL ERROR",
                    "message": f"Human annotator previously labeled this as '{classes[0]}', but model predicts '{classes[-1]}' with 95% confidence.",
                },
                "suggestions": [
                    {"label": classes[-1], "confidence": 0.95},
                    {"label": classes[0], "confidence": 0.04},
                ],
                "meaning_sub": f"⚠️ Label contradiction: Human labeled '{classes[0]}' vs Model predicts '{classes[-1]}' (0.95 confidence).",
                "highlight_phrase": "money was debited",
            },
            "low_confidence": {
                "text": "The checkout page looks clean and modern, however finding delivery tracking took more than twenty minutes.",
                "ticket_id": f"#DOC_UNCERT_{item_index + 301}",
                "why": "low model confidence (uncertainty margin < 0.05 feeds Active Learning)",
                "total": low_conf_cnt,
                "banner": {
                    "type": "warning",
                    "title": "ACTIVE LEARNING CANDIDATE",
                    "message": f"Model hesitates closely between '{classes[1] if len(classes) > 1 else classes[0]}' (0.49) and '{classes[-1]}' (0.46). Labeling this item provides maximum training gradient gain.",
                },
                "suggestions": [
                    {"label": classes[1] if len(classes) > 1 else classes[0], "confidence": 0.49},
                    {"label": classes[-1], "confidence": 0.46},
                ],
                "meaning_sub": "⚡ Active Learning trigger: Model margin < 5% between top 2 classes.",
                "highlight_phrase": "delivery tracking took more than twenty minutes",
            },
            "to_review": {
                "text": "Requested subscription cancellation last week, but received an automated promotional renewal notice today.",
                "ticket_id": f"#DOC_REV_{item_index + 401}",
                "why": "inter-annotator disagreement · requires senior supervisor review",
                "total": review_cnt,
                "banner": {
                    "type": "info",
                    "title": "SECONDARY REVIEW (DOUBLE ANNOTATION)",
                    "message": f"Annotator 1 categorized this as '{classes[-1]}', while Annotator 2 selected '{classes[1] if len(classes) > 1 else classes[0]}'. Reviewer consensus required.",
                },
                "suggestions": [
                    {"label": classes[-1], "confidence": 0.65},
                    {"label": classes[1] if len(classes) > 1 else classes[0], "confidence": 0.35},
                ],
                "meaning_sub": f"👥 Inter-annotator disagreement: Reviewer 1 ({classes[-1]}) vs Reviewer 2 ({classes[1] if len(classes) > 1 else classes[0]}).",
                "highlight_phrase": "subscription cancellation",
            },
        }

        q_info = queue_content.get(queue_id, queue_content["unlabeled"])
        cur_text = q_info["text"]
        words = cur_text.split()
        mid = len(words) // 2

        tokens = []
        if q_info["highlight_phrase"]:
            hl = q_info["highlight_phrase"]
            if hl in cur_text:
                parts = cur_text.split(hl, 1)
                tokens.append({"text": parts[0], "highlight": False})
                tokens.append({"text": hl, "highlight": True})
                tokens.append({"text": parts[1], "highlight": False})
            else:
                tokens.append({"text": cur_text, "highlight": True})
        elif len(words) > 3:
            tokens.append({"text": " ".join(words[:mid]) + " ", "highlight": False})
            tokens.append({"text": " ".join(words[mid : mid + 2]), "highlight": True})
            tokens.append({"text": " " + " ".join(words[mid + 2 :]), "highlight": False})
        else:
            tokens.append({"text": cur_text, "highlight": True})

        top_sug_label = q_info["suggestions"][0]["label"]
        labels_list = []
        for i, c in enumerate(classes, 1):
            item = {"id": i, "name": c}
            if c == top_sug_label:
                item["confidence"] = q_info["suggestions"][0]["confidence"]
                item["selected"] = True
            elif len(q_info["suggestions"]) > 1 and c == q_info["suggestions"][1]["label"]:
                item["confidence"] = q_info["suggestions"][1]["confidence"]
            labels_list.append(item)

        coverage_before = max(70, min(95, int(round(100 - (unlabeled_cnt / total_rows) * 100))))

        return {
            "dataset_id": str(dataset.id),
            "dataset_name": dataset.name,
            "display_title": dataset.name,
            "breadcrumb": f"DATASET · V{v_count} → {output_v.upper()} DRAFT · TEXT CLASSIFICATION · {len(classes)} LABELS",
            "kpis": {
                "to_label": f"{unlabeled_cnt:,}",
                "to_label_sub": f"new documents since v{v_count}",
                "suspected_errors": f"{suspected_cnt:,}",
                "suspected_errors_sub": "model disagrees ≥ 0.9",
                "done_today": f"{done_cnt:,}",
                "done_today_sub": "2 annotators · 1 reviewer",
                "output": output_v,
                "output_sub": f"v{v_count} kept as is",
            },
            "gauge": {
                "coverage_before": coverage_before,
                "coverage_after": 100,
            },
            "queues": [
                {
                    "id": "unlabeled",
                    "title": "UNLABELED",
                    "count": f"{unlabeled_cnt:,}",
                    "desc": f"Pre-labeled by {dataset.name.split('.')[0]}-cls · ready for validation",
                    "footer_done": f"{done_cnt:,} done",
                    "progress_pct": int(round((done_cnt / (unlabeled_cnt + done_cnt)) * 100)),
                    "btn_label": "Continue",
                    "active": queue_id == "unlabeled",
                },
                {
                    "id": "suspected_errors",
                    "title": "SUSPECTED ERRORS",
                    "count": f"{suspected_cnt:,}",
                    "desc": f"Labeled {classes[0]}, model predicts {classes[-1]}",
                    "footer_done": "0 done",
                    "progress_pct": 0,
                    "btn_label": "Start",
                    "active": queue_id == "suspected_errors",
                },
                {
                    "id": "low_confidence",
                    "title": "LOW CONFIDENCE",
                    "count": f"{low_conf_cnt:,}",
                    "desc": "Model hesitates between classes · feeds active learning",
                    "footer_done": f"{max(1, done_cnt // 10)} done",
                    "progress_pct": 10,
                    "btn_label": "Start",
                    "active": queue_id == "low_confidence",
                },
                {
                    "id": "to_review",
                    "title": "TO REVIEW",
                    "count": f"{review_cnt:,}",
                    "desc": "Items waiting for double validation",
                    "footer_done": "Reviewer only",
                    "progress_pct": 0,
                    "btn_label": "Review",
                    "active": queue_id == "to_review",
                },
            ],
            "queue_config": {
                "task": "One label per ticket",
                "pre_labeling": f"{dataset.name.split('.')[0]}-cls · show top 3",
                "language": "All languages",
                "double_annotation": "10% of items",
            },
            "workspace": {
                "ticket_counter": f"{queue_id.upper()} · {q_info['ticket_id']} · {item_index + 1} / {q_info['total']:,}",
                "ticket_id": q_info["ticket_id"],
                "language": "FR",
                "meta": f"document · item {item_index + 1}",
                "text_raw": cur_text,
                "tokens": tokens,
                "meaning_en": cur_text,
                "meaning_sub": q_info["meaning_sub"],
                "labels": labels_list,
                "model_suggestions": q_info["suggestions"],
                "similar_tickets": [
                    {"text": sample_texts[(item_index + 1) % len(sample_texts)], "label": classes[0].upper()},
                    {"text": sample_texts[(item_index + 2) % len(sample_texts)], "label": (classes[1] if len(classes) > 1 else classes[0]).upper()},
                ],
                "definition_title": f"DEFINITION · {top_sug_label.upper()}",
                "definition_text": f"Guidelines and criteria for assigning category {top_sug_label}.",
                "this_ticket_meta": {
                    "why_in_queue": q_info["why"],
                    "split": "train",
                    "paraphrases": "1 · inherit this label",
                },
                "queue_banner": q_info.get("banner"),
            },
            "label_checks": [
                {"id": "c1", "title": "Same text, different labels", "desc": "after trimming spaces and case", "count": max(1, int(round(total_rows * 0.02)))},
                {"id": "c2", "title": "Very short texts labeled with confidence", "desc": "under 3 words", "count": max(1, int(round(total_rows * 0.03)))},
                {"id": "c3", "title": '"other" used too often', "desc": "over 30% for one annotator", "count": 0},
                {"id": "c4", "title": "Chunks of one document labeled differently", "desc": "split documents in Cleaning", "count": max(1, int(round(total_rows * 0.01)))},
            ],
            "team": [
                {"name": "[ANNOTATOR 1]", "tickets_per_h": 180, "accepts_ai": "78%", "agreement": "0.91"},
                {"name": "[ANNOTATOR 2]", "tickets_per_h": 165, "accepts_ai": "72%", "agreement": "0.87"},
            ],
            "guardrails": [
                {"title": "Test set labeled by humans only", "subtitle": "No suggestion shown · reviewed twice", "checked": True},
                {"title": "Personal data stays masked", "subtitle": "[PHONE], [EMAIL], [NAME] never revealed", "checked": True},
                {"title": "Paraphrases follow their parent", "subtitle": "Never queued · label copied on save", "checked": True},
                {"title": "Label list changes = new version", "subtitle": "Rename, merge or add a label", "checked": True},
                {"title": "Audit on every label", "subtitle": "Who, when, suggestion accepted or chosen", "checked": True},
                {"title": f'"{classes[-1]}" is still small', "subtitle": f"{max(5, int(round(total_rows * 0.05)))} real items · collect more", "checked": False, "is_warning": True},
            ],
            "action_banner": {
                "summary": f"{done_cnt:,} labeled · {max(1, done_cnt // 8)} corrected · {max(2, done_cnt // 5)} paraphrases updated",
                "detail": f"Saved as {output_v} with the label log attached; the augmentation recipe can replay on it",
                "target_version": output_v,
            },
        }

    def submit_decision(self, dataset_id: str, payload: Dict[str, Any], db: Session) -> Dict[str, Any]:
        chosen_label = payload.get("label", "billing")
        ticket_id = payload.get("ticket_id", "#52018")
        return {
            "status": "ok",
            "message": f"Label '{chosen_label}' saved for ticket {ticket_id}",
            "ticket_id": ticket_id,
            "chosen_label": chosen_label,
            "next_index": payload.get("next_index", 1),
        }

    def save_v4_version(self, dataset_id: str, payload: Dict[str, Any], db: Session) -> Dict[str, Any]:
        target_version = payload.get("target_version", "v4")
        return {
            "status": "ok",
            "message": f"Version {target_version} created successfully and marked as BASELINE",
            "version": target_version,
            "version_hash": f"{target_version}_{int(time.time() * 1000)}",
        }


text_labeling_service = TextLabelingService()
