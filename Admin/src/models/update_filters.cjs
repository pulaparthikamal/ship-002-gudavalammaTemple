const fs = require('fs');
const path = require('path');

const modelsDir = __dirname;
const files = fs.readdirSync(modelsDir).filter(f => f.endsWith('Model.tsx'));

files.forEach(file => {
  const filePath = path.join(modelsDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Add notContains
  content = content.replace(/'contains',\s*'startsWith'/g, "'contains', 'notContains', 'startsWith'");
  
  // Try to find updatedAt columns and add date filter if it doesn't exist
  const updatedAtRegex = /key:\s*'updatedAt',([\s\S]*?)render:\s*\(/g;
  content = content.replace(updatedAtRegex, (match, inner) => {
    if (!inner.includes('filter:')) {
      return match.replace(/render:\s*\(/, `filter: {
        key: 'updatedAt',
        input: 'date',
        placeholder: 'Updated date',
      },
      render: (`);
    }
    if (inner.includes('filter:') && !inner.includes("input: 'date'")) {
       return match.replace(/filter:\s*{/, "filter: {\n        input: 'date',");
    }
    return match;
  });

  const createdAtRegex = /key:\s*'createdAt',([\s\S]*?)render:\s*\(/g;
  content = content.replace(createdAtRegex, (match, inner) => {
    if (!inner.includes('filter:')) {
      return match.replace(/render:\s*\(/, `filter: {
        key: 'createdAt',
        input: 'date',
        placeholder: 'Created date',
      },
      render: (`);
    }
    if (inner.includes('filter:') && !inner.includes("input: 'date'")) {
       return match.replace(/filter:\s*{/, "filter: {\n        input: 'date',");
    }
    return match;
  });
  
  const dateOfServiceRegex = /key:\s*'dateOfService',([\s\S]*?)render:\s*\(/g;
  content = content.replace(dateOfServiceRegex, (match, inner) => {
    if (!inner.includes('filter:')) {
      return match.replace(/render:\s*\(/, `filter: {
        key: 'dateOfService',
        input: 'date',
        placeholder: 'Date of service',
      },
      render: (`);
    }
    if (inner.includes('filter:') && !inner.includes("input: 'date'")) {
       return match.replace(/filter:\s*{/, "filter: {\n        input: 'date',");
    }
    return match;
  });

  // Replace common search aliases with their actual fields
  content = content.replace(/key:\s*'patientSearch'/g, "key: 'firstName|lastName|email|patientID'");
  content = content.replace(/key:\s*'providerSearch'/g, "key: 'firstName|lastName|email|providerID|npi'");
  content = content.replace(/key:\s*'facilitySearch'/g, "key: 'name|email|facilityID|npi'");
  content = content.replace(/key:\s*'payerSearch'/g, "key: 'name|payerID'");
  content = content.replace(/key:\s*'claimSearch'/g, "key: 'claimID|patientName'");
  content = content.replace(/key:\s*'encounterSearch'/g, "key: 'encounterID|patientName'");

  fs.writeFileSync(filePath, content, 'utf8');
});
console.log('Done modifying models');
