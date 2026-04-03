const fs = require('fs');
const dir = 'F:/New folder (3)/src/pages';

const replacements = [
  { p: /\bbg-white\b/g, r: 'bg-app-surface' },
  { p: /\bbg-gray-50\b/g, r: 'bg-app-root' },
  { p: /\bbg-gray-[1-2]00\b/g, r: 'bg-app-surface-hover' },
  { p: /\bborder-gray-[1-2]00\b/g, r: 'border-app-border' },
  { p: /\bborder-gray-50\b/g, r: 'border-app-border' },
  { p: /\btext-gray-900\b/g, r: 'text-app-text-active' },
  { p: /\btext-gray-800\b/g, r: 'text-app-text-active' },
  { p: /\btext-gray-700\b/g, r: 'text-app-text' },
  { p: /\btext-gray-600\b/g, r: 'text-app-text' },
  { p: /\btext-gray-500\b/g, r: 'text-app-text-muted' },
  { p: /\btext-gray-400\b/g, r: 'text-app-text-muted' },
  { p: /\bshadow-sm\b/g, r: 'shadow-lg shadow-black/10' },
  { p: /\bfocus:ring-blue-500\b/g, r: 'focus:border-blue-500 focus:ring-1 focus:ring-blue-500' }
];

['LeadDetails.tsx', 'Agents.tsx', 'Dashboard.tsx', 'Attendance.tsx', 'Login.tsx'].forEach(file => {
  const p = dir + '/' + file;
  if (!fs.existsSync(p)) return;
  let code = fs.readFileSync(p, 'utf8');
  replacements.forEach(({p, r}) => {
    code = code.replace(p, r);
  });
  fs.writeFileSync(p, code);
  console.log('Updated ' + file);
});
