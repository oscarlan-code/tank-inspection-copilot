#!/usr/bin/env python3
"""Source-assisted structured reconstruction, never a production PDF importer.

The evaluator ledger and original page text stay outside generator inputs.
No prose, photos, audio, model calls or native-device export are manufactured.
"""
import argparse
import datetime
import hashlib
import json
from pathlib import Path
import re
import statistics
import subprocess

PROJECT = Path(__file__).resolve().parents[2]
ROOT = PROJECT / 'docs/reviews/data/general-tank-information-v1'
NATIVE = {'client', 'tankNumber', 'location', 'fieldLeaseName', 'heightM', 'diameterM', 'shellCourseCount'}
LEFT = ['client', 'clientRepresentative', 'location', 'fieldLeaseName', 'heightM', 'serviceHeight', 'diameterM', 'productStored', 'specificGravity', 'designTemperature', 'shellCourseCount', 'roofPlateCount', 'windGirder', 'insulated', 'stiffener']
RIGHT = ['tankNumber', 'yearBuilt', 'manufacturer', 'constructionStandard', 'materialSpecification', 'shellConstruction', 'drawingReference', 'roofType', 'internalPressure', 'floorPlateCount', 'floorPlateThickness', 'annularPlateCount', 'annularPlateThickness']
LABELS = {
    'client': ['Client:'], 'clientRepresentative': ['Client', 'Representative:'], 'location': ['Location:'],
    'fieldLeaseName': ['Field/Lease Name:'], 'heightM': ['Height:'], 'serviceHeight': ['Service Height:'], 'diameterM': ['Diameter:'],
    'productStored': ['Product Stored:'], 'specificGravity': ['Specific Gravity:'], 'designTemperature': ['Design Temp.:'],
    'shellCourseCount': ['Total Shell Course:'], 'roofPlateCount': ['Total Roof Plates:'], 'windGirder': ['Wind Girder:'],
    'insulated': ['Insulated:'], 'stiffener': ['Stiffener:'], 'tankNumber': ['Tank Number:'], 'yearBuilt': ['Year Built:'],
    'manufacturer': ['Original', 'Manufacturer:'], 'constructionStandard': ['Original Construction', 'Std:'],
    'materialSpecification': ['Material Spec.:'], 'shellConstruction': ['Construction (Shell):'], 'drawingReference': ['Drawing Ref:'],
    'roofType': ['Roof Type:'], 'internalPressure': ['Internal Pres.:'], 'floorPlateCount': ['Total Floor Plates:'],
    'floorPlateThickness': ['Floor Plate Thickness:'], 'annularPlateCount': ['Total Annular Plates:'],
    'annularPlateThickness': ['Annular Plate', 'Thickness:'],
}

def digest(data):
    return hashlib.sha256(data).hexdigest()

def write_once(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    content = json.dumps(value, ensure_ascii=False, indent=2) + '\n'
    if path.exists():
        assert json.loads(path.read_text()) == value, f'Existing frozen artifact differs: {path}'
    else:
        path.write_text(content)

def extract(row):
    source = Path(row['sourcePath'])
    assert digest(source.read_bytes()) == row['sourceSha256']
    text = subprocess.check_output(['pdftotext', '-f', '1', '-l', '15', '-layout', str(source), '-'], text=True)
    pages = [(i + 1, t) for i, t in enumerate(text.split('\f'))
             if re.search(r'GENERAL\s+TANK\s+INFORMATION', t, re.I)
             and re.search(r'Year\s+Built', t, re.I)
             and not re.search(r'GENERAL\s+TANK\s+INFORMATION\s*\.{3}', t, re.I)]
    assert len(pages) == 1, f"Review source section boundaries: {row['caseId']}"
    page, text = pages[0]
    body = re.split(r'GENERAL\s+TANK\s+INFORMATION', text)[1].split('This document may contain')[0]
    main, history = re.split('Previous Inspection History', body)
    positions = [m.start() for line in main.splitlines() for m in list(re.finditer('[➢]', line))[1:]]
    assert positions
    split = round(statistics.median(positions))
    raw_cells = []
    for col in range(2):
        cells, cell = [], []
        for line in main.splitlines():
            arrows = list(re.finditer('[➢]', line))
            cut = arrows[1].start() if len(arrows) > 1 else split
            part = (line[:cut] if col == 0 else line[cut:]).strip()
            if not part:
                continue
            if part[0] in '➢':
                if cell:
                    cells.append(' '.join(cell))
                cell = [part[1:].strip()]
            elif cell:
                cell.append(part)
        if cell:
            cells.append(' '.join(cell))
        assert len(cells) == len(LEFT if col == 0 else RIGHT), (row['caseId'], col, cells)
        raw_cells += cells
    ledger = []
    for key, raw in zip(LEFT + RIGHT, raw_cells):
        clean = re.sub(r'\s+', ' ', raw).strip()
        value = clean
        for fragment in LABELS[key]:
            assert fragment in value, (row['caseId'], key, clean)
            value = value.replace(fragment, '', 1)
        value = re.sub(r'\s+', ' ', value).strip()
        assert value, (row['caseId'], key)
        ledger.append({'fieldKey': key, 'sourceCell': clean, 'expectedDisplay': value, 'page': page})
    history = history.split('Back to Content Page')[0]
    heading = next(line for line in history.splitlines() if len(list(re.finditer('[➢]', line))) == 3)
    cuts = [m.start() for m in re.finditer('[➢]', heading)] + [max(len(line) for line in history.splitlines()) + 1]
    for i, (key, label) in enumerate([('externalHistory', 'External:'), ('internalHistory', 'Internal:'), ('bottomHistory', 'Bottom:')]):
        value = re.sub(r'\s+', ' ', ' '.join(line[cuts[i]:cuts[i+1]].strip() for line in history.splitlines())).strip()
        value = re.sub('[➢]', '', value).strip()
        assert value.startswith(label), (row['caseId'], key, value)
        ledger.append({'fieldKey': key, 'sourceCell': value, 'expectedDisplay': value[len(label):].strip(), 'page': page})
    return page, text, ledger

def prepare(row):
    page, text, ledger = extract(row)
    assert len(ledger) == 31 and len({f['fieldKey'] for f in ledger}) == 31
    record, supplement = {}, {}
    for field in ledger:
        key, value = field['fieldKey'], field['expectedDisplay']
        if key in ['heightM', 'diameterM']:
            match = re.fullmatch(r'(\d+(?:\.\d+)?) m', value)
            assert match, (key, value)
            numeric = float(match[1])
            record[key] = numeric
            field['expectedValue'] = numeric
            field['expectedUnit'] = 'm'
        elif key == 'shellCourseCount':
            record[key] = int(value)
            field['expectedValue'] = int(value)
            field['expectedUnit'] = None
        elif key in NATIVE:
            record[key] = value
            field['expectedValue'] = value
            field['expectedUnit'] = None
        else:
            supplement[key] = {'value': value, 'confirmed': True, 'sourceClass': 'report_side_input',
                'sourceRef': {'kind': 'evaluation_structured_supplement', 'recordId': f"{row['caseId']}:{key}", 'reviewStatus': 'source_checked_by_codex_not_inspector'}}
            field['expectedValue'] = value
            field['expectedUnit'] = None
        field['inputChannel'] = 'app_field' if key in NATIVE else 'report_side_input'
    # An app-shaped section fixture, not an assertion that a complete native
    # inspection or its 195 checklist responses have been captured/exported.
    package = {'packageType': 'v3_product_export', 'schemaVersion': 3, 'inspectionId': row['caseId'],
        'inspectionReference': row['caseId'], 'inspectionRecord': {'inspectionId': row['caseId'], **record},
        'task': {key: record[key] for key in ['client', 'tankNumber', 'location']},
        **{key: [] for key in ['utMeasurements', 'layoutConfigs', 'layoutFigures', 'layoutTargets', 'elements', 'findings', 'voiceNotes', 'attachments', 'inspectionChecklistItems', 'inspectionChecklistSectionNotes', 'taskSnapshots']}}
    inputs = {'exportPackage': package, 'manualSupplement': {'generalTankInformation': supplement}}
    write_once(ROOT / 'inputs' / f"{row['caseId']}.json", inputs)
    write_once(ROOT / 'evaluator-only' / f"{row['caseId']}-expected.json", {'sourceSha256': row['sourceSha256'], 'page': page, 'fields': ledger})
    # Existing source previews were captured before authoring; preserve them.
    source_path = ROOT / 'evaluator-only' / f"{row['caseId']}-source.json"
    if not source_path.exists():
        write_once(source_path, {'page': page, 'text': text, 'sourceSha256': row['sourceSha256']})
    return {'caseId': row['caseId'], 'split': row['split'], 'sourcePage': page, 'fieldCount': len(ledger),
        'nativeFieldCount': len(record), 'supplementFieldCount': len(supplement),
        'inputSha256': digest((ROOT / 'inputs' / f"{row['caseId']}.json").read_bytes()),
        'expectedSha256': digest((ROOT / 'evaluator-only' / f"{row['caseId']}-expected.json").read_bytes())}

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--split', choices=['development', 'held_out'], required=True)
    args = parser.parse_args()
    if args.split == 'held_out':
        freeze = json.loads((ROOT / 'development-freeze.json').read_text())
        for name, expected in freeze['codeHashes'].items():
            assert digest((PROJECT / name).read_bytes()) == expected, f'Development changed after freeze: {name}'
    cohort = json.loads((ROOT / 'cohort.json').read_text())
    selected = [row for row in cohort['cases'] if row['split'] == args.split]
    rows = [prepare(row) for row in selected]
    write_once(ROOT / f'{args.split}-preparation.json', {'split': args.split, 'cases': rows,
        'sourceDerived': True, 'actualDeviceExport': False, 'actualVoiceOrAsr': False, 'paidAiCalls': 0,
        'notes': 'Structured source fields retained exactly, with only numeric formatting normalized. Seven native fields; 24 explicitly labelled report-side inputs. No historical narrative sentences used as mock notes.'})
    print(json.dumps({'split': args.split, 'cases': len(rows), 'fields': sum(r['fieldCount'] for r in rows), 'paidAiCalls': 0}))
