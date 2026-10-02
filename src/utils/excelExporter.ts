/**
 * Excel / Spreadsheet Exporter Utility
 * Generates clean spreadsheet files (CSV / Excel compatible) containing student credentials.
 */

export interface StudentCredential {
  name: string;
  email: string;
  generatedPassword: string;
}

/**
 * Downloads student credentials in standard CSV format that opens natively in Microsoft Excel
 */
export function downloadStudentCredentialsExcel(
  students: StudentCredential[],
  filename = 'imported_student_credentials.csv'
) {
  if (!students || students.length === 0) return;

  const headers = ['Name', 'Email', 'Password'];
  const rows = students.map((s) => [
    `"${(s.name || '').replace(/"/g, '""')}"`,
    `"${(s.email || '').replace(/"/g, '""')}"`,
    `"${(s.generatedPassword || '').replace(/"/g, '""')}"`,
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');

  // UTF-8 BOM (\ufeff) allows Microsoft Excel on Windows & Mac to recognize the file encoding immediately
  const blob = new Blob(['\ufeff' + csvContent], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
