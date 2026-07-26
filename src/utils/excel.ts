import JSZip from 'jszip'
import type { GoodsEntry } from '../types'
import { getImageBlob } from '../db'
import { formatTime } from './format'

const EMU_PER_PX = 9525
const THUMB_PX = 96
const GAP_PX = 8

function esc(v: string): string {
  return v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function cellRef(col: number, row: number): string {
  let c = col
  let sb = ''
  do {
    sb = String.fromCharCode(65 + (c % 26)) + sb
    c = Math.floor(c / 26) - 1
  } while (c >= 0)
  return `${sb}${row}`
}

async function compressImage(blob: Blob): Promise<Uint8Array | null> {
  try {
    const bitmap = await createImageBitmap(blob)
    const maxSide = Math.max(bitmap.width, bitmap.height)
    const ratio = maxSide > THUMB_PX ? THUMB_PX / maxSide : 1
    const w = Math.max(1, Math.round(bitmap.width * ratio))
    const h = Math.max(1, Math.round(bitmap.height * ratio))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bitmap.close()
      return null
    }
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close()
    const out = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.85)
    )
    if (!out) return null
    return new Uint8Array(await out.arrayBuffer())
  } catch {
    return null
  }
}

export async function exportExcel(entries: GoodsEntry[]): Promise<Blob> {
  type EmbeddedImage = {
    rowIndex: number
    indexInRow: number
    bytes: Uint8Array
    mediaName: string
    relId: string
  }

  const images: EmbeddedImage[] = []
  let mediaSeq = 1

  for (let index = 0; index < entries.length; index++) {
    const keys = entries[index].imageKeys.split('|').filter(Boolean)
    for (let imgIndex = 0; imgIndex < keys.length; imgIndex++) {
      const blob = await getImageBlob(keys[imgIndex])
      if (!blob) continue
      const bytes = await compressImage(blob)
      if (!bytes) continue
      images.push({
        rowIndex: index + 1,
        indexInRow: imgIndex,
        bytes,
        mediaName: `image${mediaSeq}.jpg`,
        relId: `rId${mediaSeq}`,
      })
      mediaSeq++
    }
  }

  const headers = ['No', 'Code', 'Price', 'Qty', 'Total', 'Images', 'Note', 'Time']
  const textRows: string[][] = [headers]
  entries.forEach((e, index) => {
    textRows.push([
      String(index + 1),
      e.productCode,
      String(e.unitPrice),
      String(e.quantity),
      String(e.totalAmount),
      '',
      e.note,
      formatTime(e.createdAt, 'detail'),
    ])
  })

  const shared = new Map<string, number>()
  const sid = (v: string) => {
    if (!shared.has(v)) shared.set(v, shared.size)
    return shared.get(v)!
  }
  // Pre-register all strings
  textRows.flat().forEach(sid)

  const maxImagesInRow =
    entries.reduce((max, e) => {
      const n = e.imageKeys.split('|').filter(Boolean).length
      return Math.max(max, n)
    }, 0) || 0
  const imageColWidth = Math.max(
    18,
    (Math.max(maxImagesInRow, 1) * (THUMB_PX + GAP_PX) + 20) / 7
  )

  let sheetRows = ''
  textRows.forEach((cols, rIndex) => {
    const excelRow = rIndex + 1
    const hasImage =
      rIndex > 0 && entries[rIndex - 1].imageKeys.split('|').some(Boolean)
    sheetRows += hasImage
      ? `<row r="${excelRow}" ht="78" customHeight="1">`
      : `<row r="${excelRow}">`
    cols.forEach((value, cIndex) => {
      sheetRows += `<c r="${cellRef(cIndex, excelRow)}" t="s"><v>${sid(value)}</v></c>`
    })
    sheetRows += '</row>'
  })

  const zip = new JSZip()

  let contentTypes =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Default Extension="jpg" ContentType="image/jpeg"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
    `<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>`
  if (images.length > 0) {
    contentTypes += `<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`
  }
  contentTypes += '</Types>'
  zip.file('[Content_Types].xml', contentTypes)

  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
  )

  zip.file(
    'xl/workbook.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Records" sheetId="1" r:id="rId1"/></sheets>
</workbook>`
  )

  zip.file(
    'xl/_rels/workbook.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>`
  )

  let sst = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
  sst += `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${shared.size}" uniqueCount="${shared.size}">`
  for (const key of shared.keys()) {
    sst += `<si><t>${esc(key)}</t></si>`
  }
  sst += '</sst>'
  zip.file('xl/sharedStrings.xml', sst)

  const drawingTag = images.length > 0 ? `<drawing r:id="rId1"/>` : ''
  zip.file(
    'xl/worksheets/sheet1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
           xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <cols>
    <col min="1" max="1" width="6" customWidth="1"/>
    <col min="2" max="2" width="16" customWidth="1"/>
    <col min="3" max="5" width="10" customWidth="1"/>
    <col min="6" max="6" width="${imageColWidth.toFixed(2)}" customWidth="1"/>
    <col min="7" max="7" width="18" customWidth="1"/>
    <col min="8" max="8" width="18" customWidth="1"/>
  </cols>
  <sheetData>${sheetRows}</sheetData>
  ${drawingTag}
</worksheet>`
  )

  if (images.length > 0) {
    zip.file(
      'xl/worksheets/_rels/sheet1.xml.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/>
</Relationships>`
    )

    let drawingXml =
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" ` +
      `xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ` +
      `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">`
    images.forEach((img, idx) => {
      const colOff = img.indexInRow * (THUMB_PX + GAP_PX) * EMU_PER_PX
      const sizeEmu = THUMB_PX * EMU_PER_PX
      const picId = idx + 1
      drawingXml +=
        `<xdr:oneCellAnchor>` +
        `<xdr:from><xdr:col>5</xdr:col><xdr:colOff>${colOff}</xdr:colOff>` +
        `<xdr:row>${img.rowIndex}</xdr:row><xdr:rowOff>47625</xdr:rowOff></xdr:from>` +
        `<xdr:ext cx="${sizeEmu}" cy="${sizeEmu}"/>` +
        `<xdr:pic>` +
        `<xdr:nvPicPr><xdr:cNvPr id="${picId}" name="Picture ${picId}"/><xdr:cNvPicPr/></xdr:nvPicPr>` +
        `<xdr:blipFill><a:blip r:embed="${img.relId}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>` +
        `<xdr:spPr><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr>` +
        `</xdr:pic><xdr:clientData/></xdr:oneCellAnchor>`
    })
    drawingXml += '</xdr:wsDr>'
    zip.file('xl/drawings/drawing1.xml', drawingXml)

    let drawingRels =
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
    images.forEach((img) => {
      drawingRels += `<Relationship Id="${img.relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${img.mediaName}"/>`
    })
    drawingRels += '</Relationships>'
    zip.file('xl/drawings/_rels/drawing1.xml.rels', drawingRels)

    images.forEach((img) => {
      zip.file(`xl/media/${img.mediaName}`, img.bytes)
    })
  }

  return zip.generateAsync({ type: 'blob' })
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
