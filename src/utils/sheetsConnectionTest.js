import { readSheetData } from '@/services/googleSheetsService';
import { googleSheetsConfig } from '@/config/googleSheetsConfig';

export const testGoogleSheetsConnection = async () => {
  console.log('--- STARTING GOOGLE SHEETS CONNECTION TEST ---');
  console.log(`Target Spreadsheet ID: ${googleSheetsConfig.spreadsheetId}`);
  
  try {
    const startTime = Date.now();
    const data = await readSheetData(googleSheetsConfig.sheets.USUARIOS, 'A1:C5');
    const duration = Date.now() - startTime;
    
    if (data && data.length > 0) {
      console.log('✅ Connection Successful!');
      console.log(`⏱️ Duration: ${duration}ms`);
      console.log(`📊 Rows retrieved: ${data.length}`);
      console.log('📝 Sample Data (Headers):', data[0]);
    } else {
      console.warn('⚠️ Connection succeeded but no data was returned.');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Connection Failed!');
    console.error('Error details:', error.message);
    if (error.code === 403) {
      console.error('HINT: Check if the Service Account email has been added as an Editor to the Google Sheet.');
    }
    return false;
  } finally {
    console.log('--- TEST COMPLETE ---');
  }
};