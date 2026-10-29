import io
from datetime import datetime, timezone
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether, HRFlowable
)
from app.schemas.record import ClinicalRecord

def generate_clinical_report_pdf(record: ClinicalRecord, integrity_status: bool = True) -> bytes:
    """Generate a printable clinical emergency medical record PDF using ReportLab."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontSize=20,
        leading=24,
        textColor=colors.HexColor('#0f172a'),
        fontName='Helvetica-Bold'
    )
    
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#475569')
    )
    
    section_heading = ParagraphStyle(
        'SectionHeading',
        parent=styles['Heading2'],
        fontSize=12,
        leading=16,
        textColor=colors.HexColor('#1e293b'),
        fontName='Helvetica-Bold',
        spaceBefore=8,
        spaceAfter=4
    )

    body_style = ParagraphStyle(
        'BodyDark',
        parent=styles['Normal'],
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#1e293b')
    )
    
    cell_style = ParagraphStyle(
        'CellText',
        parent=styles['Normal'],
        fontSize=8,
        leading=11,
        textColor=colors.HexColor('#1e293b')
    )
    
    cell_bold = ParagraphStyle(
        'CellBold',
        parent=styles['Normal'],
        fontSize=8,
        leading=11,
        fontName='Helvetica-Bold',
        textColor=colors.HexColor('#0f172a')
    )

    disclaimer_style = ParagraphStyle(
        'DisclaimerText',
        parent=styles['Normal'],
        fontSize=7,
        leading=9,
        textColor=colors.HexColor('#64748b'),
        alignment=1
    )

    elements = []

    # 1. Header Banner
    header_data = [
        [
            Paragraph("<b>FIELD-TO-RECORD</b> &bull; Emergency Clinical Care Record", title_style),
            Paragraph(f"<b>STATUS:</b> <font color='{'#15803d' if record.audit.record_status == 'approved' else '#b45309'}'>{record.audit.record_status.upper()}</font><br/><b>Rev:</b> #{record.audit.revision}", subtitle_style)
        ]
    ]
    header_table = Table(header_data, colWidths=[380, 160])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 8))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#0284c7'), spaceAfter=8))

    # 2. Metadata Box
    created_time = record.source.created_at[:19].replace('T', ' ')
    verified_text = "<font color='#16a34a'><b>INTEGRITY VERIFIED (SHA-256)</b></font>" if integrity_status else "<font color='#dc2626'><b>CHAIN TAMPER DETECTED</b></font>"
    
    meta_data = [
        [
            Paragraph(f"<b>Record ID:</b> {record.record_id}", cell_style),
            Paragraph(f"<b>Created:</b> {created_time} UTC", cell_style)
        ],
        [
            Paragraph(f"<b>Responder / Unit:</b> {record.audit.created_by}", cell_style),
            Paragraph(f"<b>Modality:</b> {record.source.type.replace('_', ' ').title()}", cell_style)
        ],
        [
            Paragraph(f"<b>Cryptographic Hash Chain:</b> {verified_text}", cell_style),
            Paragraph(f"<b>Schema Version:</b> {record.schema_version}", cell_style)
        ]
    ]
    meta_table = Table(meta_data, colWidths=[270, 270])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8fafc')),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(meta_table)
    elements.append(Spacer(1, 10))

    # 3. Original Field Note
    elements.append(Paragraph("ORIGINAL FIELD NOTE / ON-SCENE TRANSCRIPT", section_heading))
    note_content = [
        [Paragraph(f"<i>\"{record.source.original_text}\"</i>", body_style)]
    ]
    note_table = Table(note_content, colWidths=[540])
    note_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f1f5f9')),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#94a3b8')),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(note_table)
    elements.append(Spacer(1, 12))

    # 4. Chronological Events Table
    elements.append(Paragraph("STRUCTURED CLINICAL EVENTS (CHRONOLOGICAL)", section_heading))
    
    event_rows = [
        [
            Paragraph("<b>Time</b>", cell_bold),
            Paragraph("<b>Type / Entity</b>", cell_bold),
            Paragraph("<b>Dose & Route / Details</b>", cell_bold),
            Paragraph("<b>Status</b>", cell_bold),
            Paragraph("<b>Confidence</b>", cell_bold),
            Paragraph("<b>Verification</b>", cell_bold)
        ]
    ]

    for ev in record.events:
        # Time
        time_str = ev.event_time or "Unknown"
        
        # Entity
        if ev.event_type == "medication_administration" and ev.medication:
            entity_str = f"<b>{ev.medication.name}</b>"
            if ev.medication.code:
                entity_str += f"<br/><font color='#64748b' size='7'>RxNorm: {ev.medication.code}</font>"
        elif ev.event_type == "procedure":
            entity_str = f"<b>{ev.procedure_name or 'Procedure'}</b>"
            if ev.procedure_method:
                entity_str += f"<br/><font color='#64748b' size='7'>{ev.procedure_method}</font>"
        else:
            entity_str = f"<b>{ev.observation_name or 'Observation'}</b>"
            if ev.observation_value:
                entity_str += f": {ev.observation_value}"

        # Dose & Route
        dose_parts = []
        if ev.dose and ev.dose.value is not None:
            dose_parts.append(f"{ev.dose.value} {ev.dose.unit or ''}")
        if ev.route and ev.route.normalized:
            dose_parts.append(f"Route: {ev.route.normalized.upper()} ({ev.route.original})")
        details_str = "<br/>".join(dose_parts) if dose_parts else "<font color='#94a3b8'>None recorded</font>"

        # Status
        status_colors = {
            "administered": "#15803d",
            "planned": "#b45309",
            "withheld": "#dc2626",
            "refused": "#b91c1c",
            "prior_administration": "#4338ca",
            "mentioned": "#475569"
        }
        color = status_colors.get(ev.administration_status, "#0f172a")
        status_str = f"<font color='{color}'><b>{ev.administration_status.upper()}</b></font>"
        if ev.is_correction:
            status_str += "<br/><font color='#b45309' size='7'>CORRECTION</font>"

        # Confidence
        conf_pct = int(ev.confidence * 100)
        conf_str = f"{conf_pct}%"

        # Verification
        rev_str = ev.review_status.title()

        event_rows.append([
            Paragraph(time_str, cell_style),
            Paragraph(entity_str, cell_style),
            Paragraph(details_str, cell_style),
            Paragraph(status_str, cell_style),
            Paragraph(conf_str, cell_style),
            Paragraph(rev_str, cell_style)
        ])

    events_table = Table(event_rows, colWidths=[55, 140, 160, 85, 45, 55])
    events_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e2e8f0')),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#94a3b8')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    elements.append(events_table)
    elements.append(Spacer(1, 14))

    # 5. Reviewer Sign-Off Box
    sign_data = [
        [
            Paragraph("<b>CLINICAL REVIEWER SIGN-OFF:</b>", cell_bold),
            Paragraph(f"Status: <b>{record.audit.record_status.upper()}</b>", cell_style),
            Paragraph(f"Reviewed By: <b>{record.audit.last_modified_by}</b>", cell_style)
        ]
    ]
    sign_table = Table(sign_data, colWidths=[180, 180, 180])
    sign_table.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8fafc')),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(KeepTogether(sign_table))
    elements.append(Spacer(1, 14))

    # 6. Safety & Legal Disclaimer
    disclaimer_text = (
        "<b>CLINICAL & SAFETY DISCLAIMER:</b> This document was generated by Field-to-Record clinical NLP assistance. "
        "AI extractions are assistive and MUST be reviewed and verified by a licensed clinician or authorized emergency responder "
        "before being integrated into an official electronic health record (EHR). Does not constitute legal medical certification without authorized signature."
    )
    elements.append(Paragraph(disclaimer_text, disclaimer_style))

    doc.build(elements)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
