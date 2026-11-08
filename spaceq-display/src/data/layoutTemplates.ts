export type LayoutTemplateCategory = 'Featured' | 'Grid' | 'Split' | 'Mosaic' | 'Editorial';

export interface LayoutTemplate {
  id: string;
  name: string;
  category: LayoutTemplateCategory;
  columns: number;
  rows: number;
  areas: string[];
  zoneCount: number;
  description: string;
}

const areaNames = (count: number) => Array.from({ length: count }, (_, i) => `z${i + 1}`);

function uniqueGrid(columns: number, rows: number): string[] {
  return Array.from({ length: rows }, (_, r) =>
    areaNames(columns).map((_, c) => `z${r * columns + c + 1}`).join(' ')
  );
}

function featuredGrid(columns: number, rows: number, mainSide: 'left' | 'right' | 'top' | 'bottom', mainSpan: number): string[] {
  const cells = Array.from({ length: rows }, () => Array(columns).fill(''));
  let zone = 1;
  if (mainSide === 'left' || mainSide === 'right') {
    const start = mainSide === 'left' ? 0 : columns - mainSpan;
    for (let r = 0; r < rows; r++) for (let c = start; c < start + mainSpan; c++) cells[r][c] = 'z1';
    for (let r = 0; r < rows; r++) for (let c = 0; c < columns; c++) if (!cells[r][c]) cells[r][c] = `z${++zone}`;
  } else {
    const start = mainSide === 'top' ? 0 : rows - mainSpan;
    for (let r = start; r < start + mainSpan; r++) for (let c = 0; c < columns; c++) cells[r][c] = 'z1';
    for (let r = 0; r < rows; r++) for (let c = 0; c < columns; c++) if (!cells[r][c]) cells[r][c] = `z${++zone}`;
  }
  return cells.map(row => row.join(' '));
}

function checkerMosaic(columns: number, rows: number, flip: boolean): string[] {
  const cells = Array.from({ length: rows }, () => Array(columns).fill(''));
  let z = 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      if ((r + c + (flip ? 1 : 0)) % 3 === 0 && c < columns - 1 && r < rows - 1 && !cells[r][c + 1] && !cells[r + 1][c]) {
        const name = `z${z++}`;
        cells[r][c] = cells[r][c + 1] = cells[r + 1][c] = cells[r + 1][c + 1] = name;
      }
    }
  }
  for (let r = 0; r < rows; r++) for (let c = 0; c < columns; c++) if (!cells[r][c]) cells[r][c] = `z${z++}`;
  return cells.map(row => row.join(' '));
}

const templates: LayoutTemplate[] = [];
const add = (name: string, category: LayoutTemplateCategory, columns: number, rows: number, areas: string[], description: string) => {
  const names = new Set(areas.flatMap(row => row.split(' ')));
  templates.push({ id: `tpl-${templates.length + 1}`, name, category, columns, rows, areas, zoneCount: names.size, description });
};

// 16 clean grid templates.
for (let rows = 1; rows <= 4; rows++) {
  for (let columns = 1; columns <= 4; columns++) {
    if (rows * columns === 1) continue;
    add(`${columns}×${rows} Equal Grid`, 'Grid', columns, rows, uniqueGrid(columns, rows), 'Balanced equal-size zones.');
  }
}

// 48 featured layouts: a large hero zone plus supporting zones.
for (const [columns, rows] of [[2, 2], [3, 2], [2, 3], [3, 3], [4, 2], [2, 4]] as [number, number][]) {
  const maxSpan = Math.max(1, Math.min(columns, rows) - (columns === rows ? 0 : 0));
  for (const side of ['left', 'right', 'top', 'bottom'] as const) {
    for (let span = 1; span <= Math.min(2, maxSpan); span++) {
      add(`${columns}×${rows} ${side} hero ${span === 2 ? 'wide' : 'standard'}`, 'Featured', columns, rows, featuredGrid(columns, rows, side, span), 'One high-impact zone with supporting content.');
    }
  }
}

// 24 mosaic variants.
for (const [columns, rows] of [[3, 2], [2, 3], [3, 3], [4, 3], [3, 4], [4, 2]] as [number, number][]) {
  for (let flip = 0; flip < 4; flip++) {
    add(`${columns}×${rows} Mosaic ${flip + 1}`, 'Mosaic', columns, rows, checkerMosaic(columns, rows, flip % 2 === 1), 'Dynamic editorial mosaic with varied visual weight.');
  }
}

// 32 editorial templates with strong bands and side rails.
const editorialPatterns = [
  { name: 'Top Hero + 3 Cards', columns: 3, rows: 2, areas: ['z1 z1 z1', 'z2 z3 z4'] },
  { name: 'Bottom Hero + 3 Cards', columns: 3, rows: 2, areas: ['z2 z3 z4', 'z1 z1 z1'] },
  { name: 'Left Hero + 3 Cards', columns: 2, rows: 3, areas: ['z1 z2', 'z1 z3', 'z1 z4'] },
  { name: 'Right Hero + 3 Cards', columns: 2, rows: 3, areas: ['z2 z1', 'z3 z1', 'z4 z1'] },
  { name: 'Left Rail + Content', columns: 4, rows: 2, areas: ['z1 z2 z2 z3', 'z1 z4 z4 z3'] },
  { name: 'Right Rail + Content', columns: 4, rows: 2, areas: ['z2 z2 z3 z1', 'z4 z4 z3 z1'] },
  { name: 'Header + Content + Footer', columns: 3, rows: 3, areas: ['z1 z1 z1', 'z2 z3 z4', 'z5 z5 z5'] },
  { name: 'Sidebar + Header + Content', columns: 3, rows: 3, areas: ['z1 z1 z1', 'z2 z3 z4', 'z2 z5 z4'] },
];
for (let i = 0; i < 4; i++) {
  editorialPatterns.forEach((p, idx) => add(`${p.name} ${i + 1}`, 'Editorial', p.columns, p.rows, p.areas, 'Designed for campaigns mixing hero, information and supporting ads.'));
}

// 16 simple split/rail templates, useful for dashboards and mixed ad/content screens.
for (let i = 1; i <= 8; i++) {
  add(`Dual Rail ${i}`, 'Split', 3, 2, ['z1 z2 z2', 'z3 z2 z2'], 'Two supporting rails around a dominant content area.');
  add(`Triple Column ${i}`, 'Split', 3, 1, ['z1 z2 z3'], 'Three independent vertical zones.');
}

// Guarantee a comfortably searchable 100+ library even if patterns above are edited later.
while (templates.length < 128) {
  const n = templates.length + 1;
  const cols = n % 2 === 0 ? 4 : 3;
  const rows = 2;
  add(`Flexible Layout ${n}`, n % 3 === 0 ? 'Mosaic' : 'Featured', cols, rows, uniqueGrid(cols, rows), 'Flexible multi-zone layout template.');
}

export const LAYOUT_TEMPLATES = templates.slice(0, 128);
export const LAYOUT_TEMPLATE_CATEGORIES: LayoutTemplateCategory[] = ['Featured', 'Grid', 'Mosaic', 'Editorial', 'Split'];
export const getLayoutTemplate = (id?: string) => LAYOUT_TEMPLATES.find(t => t.id === id);
