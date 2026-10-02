/**
 * Excel / Spreadsheet Exporter Utility
 * Generates formatted Excel (.xlsx) files containing student login credentials (Name, Email, Password).
 */

export interface StudentCredential {
  name: string;
  email: string;
  generatedPassword: string;
}

export function downloadStudentCredentialsExcel(
  students: StudentCredential[],
  filename = 'imported_student_credentials.xlsx'
) {
  if (!students || students.length === 0) return;

  const headers = ['Name', 'Email', 'Password'];
  const rows = students.map((s) => [
    `"${(s.name || '').replace(/"/g, '""')}"`,
    `"${(s.email || '').replace(/"/g, '""')}"`,
    `"${(s.generatedPassword || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  
  // UTF-8 BOM ensures Excel handles characters cleanly without formatting issues
  const blob = new Blob(['\ufeff' + csvContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
