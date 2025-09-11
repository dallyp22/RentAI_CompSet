export interface ExcelExportData {
  propertyInfo: {
    address: string;
    type: string;
    units: number;
    builtYear: number;
  };
  units: Array<{
    unitNumber: string;
    unitType: string;
    currentRent: number;
    recommendedRent?: number;
    change: number;
    annualImpact: number;
    status: string;
  }>;
  summary: {
    totalIncrease: number;
    affectedUnits: number;
    avgIncrease: number;
    riskLevel: string;
  };
}

export function exportToExcel(data: ExcelExportData): void {
  // Create CSV content as a simple Excel-compatible format
  const csvContent = generateCSV(data);
  
  // Create and download the file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `property-optimization-${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

function generateCSV(data: ExcelExportData): string {
  let csv = '';
  
  // Property Information
  csv += 'Property Optimization Report\n';
  csv += `Generated on: ${new Date().toLocaleDateString()}\n\n`;
  csv += 'Property Information\n';
  csv += `Address,${data.propertyInfo.address}\n`;
  csv += `Type,${data.propertyInfo.type}\n`;
  csv += `Total Units,${data.propertyInfo.units}\n`;
  csv += `Built Year,${data.propertyInfo.builtYear}\n\n`;
  
  // Units Detail
  csv += 'Unit Details\n';
  csv += 'Unit Number,Unit Type,Current Rent,Recommended Rent,Change,Annual Impact,Status\n';
  
  data.units.forEach(unit => {
    csv += `${unit.unitNumber},${unit.unitType},$${unit.currentRent},$${unit.recommendedRent || unit.currentRent},$${unit.change},$${unit.annualImpact},${unit.status}\n`;
  });
  
  // Summary
  csv += '\nOptimization Summary\n';
  csv += `Total Annual Revenue Increase,$${data.summary.totalIncrease}\n`;
  csv += `Units Affected,${data.summary.affectedUnits}\n`;
  csv += `Average Increase,${data.summary.avgIncrease}%\n`;
  csv += `Risk Level,${data.summary.riskLevel}\n`;
  
  return csv;
}
