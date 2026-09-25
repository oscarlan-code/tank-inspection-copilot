from __future__ import annotations

import json
import shlex
import subprocess

from .models import DerivedAnnotation, EscalationRequest


def run_command_provider(
    requests: tuple[EscalationRequest, ...],
    *,
    command: str,
    timeout_seconds: int,
) -> tuple[DerivedAnnotation, ...]:
    argv = shlex.split(command)
    if not argv:
        raise ValueError("AI escalation command cannot be empty.")

    annotations: list[DerivedAnnotation] = []
    for request in requests:
        completed = subprocess.run(
            argv,
            input=request.model_dump_json(),
            text=True,
            capture_output=True,
            check=False,
            timeout=timeout_seconds,
        )
        if completed.returncode != 0:
            raise RuntimeError(
                f"AI escalation provider failed for {request.request_id}: "
                f"{completed.stderr.strip() or 'no error output'}"
            )
        try:
            payload = json.loads(completed.stdout)
            annotation = DerivedAnnotation.model_validate(payload)
        except (json.JSONDecodeError, ValueError) as error:
            raise RuntimeError(
                f"AI escalation provider returned invalid JSON for {request.request_id}."
            ) from error
        _validate_annotation(request, annotation)
        annotations.append(annotation)
    return tuple(annotations)


def _validate_annotation(
    request: EscalationRequest,
    annotation: DerivedAnnotation,
) -> None:
    if annotation.request_id != request.request_id:
        raise ValueError("AI annotation request_id does not match its escalation request.")
    if not set(annotation.source_block_ids).issubset(request.source_block_ids):
        raise ValueError("AI annotation cites a block outside the controlled escalation request.")
    for relationship in annotation.relationship_candidates:
        if relationship.source_block_id not in request.source_block_ids:
            raise ValueError("AI relationship source is outside the escalation evidence.")
        if relationship.target_block_id not in request.source_block_ids:
            raise ValueError("AI relationship target is outside the escalation evidence.")

    proposed_fields = {
        field_name
        for field_name, value in (
            ("proposed_section_key", annotation.proposed_section_key),
            ("proposed_block_type", annotation.proposed_block_type),
            ("relationship_candidates", annotation.relationship_candidates),
        )
        if value
    }
    disallowed_fields = proposed_fields.difference(request.allowed_output_fields)
    if disallowed_fields:
        fields = ", ".join(sorted(disallowed_fields))
        raise ValueError(f"AI annotation returned fields not allowed by the request: {fields}.")
