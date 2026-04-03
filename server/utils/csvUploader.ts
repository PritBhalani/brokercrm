import fs from 'fs';
import csv from 'csv-parser';
import { Lead, User } from '../models/Models.ts';

export const processCSV = async (filePath: string, performedBy: string, io: any) => {
  return new Promise((resolve, reject) => {
    const leadsData: any[] = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        const lead = {
          name: row.name,
          phone: row.phone,
          email: row.email,
          investmentInterest: row.investmentInterest,
          status: row.status || 'New',
          assignedAgent: null,
          activityLog: [{
            action: 'Lead uploaded via CSV',
            performedBy,
            timestamp: new Date()
          }]
        };
        leadsData.push(lead);
      })
      .on('end', async () => {
        try {
          for (const item of leadsData) {
            await Lead.create(item);
          }
          fs.unlinkSync(filePath);
          resolve(leadsData.length);
        } catch (error) {
          reject(error);
        }
      })
      .on('error', (error) => reject(error));
  });
};
