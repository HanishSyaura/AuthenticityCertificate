export function nextSortState(currentState, columnId) {
  if (!columnId) return null;

  if (currentState?.columnId !== columnId) {
    return { columnId, direction: 'asc' };
  }

  if (currentState.direction === 'asc') {
    return { columnId, direction: 'desc' };
  }

  return null;
}

function getColumnValue(row, column) {
  if (typeof column?.accessor === 'function') {
    return column.accessor(row);
  }

  if (typeof column?.getValue === 'function') {
    return column.getValue(row);
  }

  const key = column?.accessorKey ?? column?.accessor ?? column?.key ?? column?.id;
  if (!key) return undefined;

  return String(key).split('.').reduce(
    (value, part) => value == null ? undefined : value[part],
    row
  );
}

function compareValues(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;

  const dateA = a instanceof Date ? a.getTime() : Date.parse(a);
  const dateB = b instanceof Date ? b.getTime() : Date.parse(b);

  if (
    typeof a !== 'number' &&
    typeof b !== 'number' &&
    !Number.isNaN(dateA) &&
    !Number.isNaN(dateB) &&
    String(a).trim() &&
    String(b).trim()
  ) {
    return dateA - dateB;
  }

  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }

  const numberA = Number(a);
  const numberB = Number(b);

  if (
    String(a).trim() !== '' &&
    String(b).trim() !== '' &&
    Number.isFinite(numberA) &&
    Number.isFinite(numberB)
  ) {
    return numberA - numberB;
  }

  return String(a).localeCompare(String(b), undefined, {
    numeric: true,
    sensitivity: 'base'
  });
}

export function sortRows(rows, sortState, columns = []) {
  if (!Array.isArray(rows)) return [];
  if (!sortState?.columnId || !['asc', 'desc'].includes(sortState.direction)) {
    return rows;
  }

  const column = columns.find((item) => item?.id === sortState.columnId);
  if (!column || column.sortable === false) return rows;

  const direction = sortState.direction === 'desc' ? -1 : 1;

  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const result = compareValues(
        getColumnValue(a.row, column),
        getColumnValue(b.row, column)
      );

      return result === 0 ? a.index - b.index : result * direction;
    })
    .map(({ row }) => row);
}
