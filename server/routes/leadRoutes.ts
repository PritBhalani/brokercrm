import express from 'express';
import multer from 'multer';
import { 
  getLeads, 
  getLeadById, 
  updateLeadStatus, 
  assignLead, 
  getDashboardStats,
  createLead,
  deleteLead,
  addTrade,
  bulkTransferLeads,
  bulkAssignLeads,
  bulkDeleteLeads,
  assignUnassignedLeadsEqually,
  markAsFT,
  addPayment,
  getAgentTradeQueue,
  recordNoTradeToday,
  getCollectionLabels,
} from '../controllers/leadController.ts';
import { protect, authorize } from '../middleware/auth.ts';
import { processCSV } from '../utils/csvUploader.ts';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

router.get('/', protect, getLeads);
router.post('/', protect, authorize('admin'), createLead);
router.get('/stats', protect, authorize('admin'), getDashboardStats);

router.get('/agent/trade-queue', protect, authorize('agent'), getAgentTradeQueue);
router.get('/collection-labels', protect, getCollectionLabels);

// Static paths MUST come before /:id parameterized paths
router.post('/bulk/transfer', protect, authorize('admin'), bulkTransferLeads);
router.post('/bulk/assign', protect, authorize('admin'), bulkAssignLeads);
router.post('/bulk/delete', protect, authorize('admin'), bulkDeleteLeads);
router.post('/assign-unassigned', protect, authorize('admin'), assignUnassignedLeadsEqually);

// Parameterized paths
router.post('/:id/trade-skip', protect, recordNoTradeToday);
router.get('/:id', protect, getLeadById);
router.patch('/:id/status', protect, updateLeadStatus);
router.patch('/:id/mark-ft', protect, markAsFT);
router.post('/:id/trades', protect, addTrade);
router.post('/:id/payments', protect, addPayment);
router.patch('/:id/assign', protect, authorize('admin'), assignLead);
router.delete('/:id', protect, authorize('admin'), deleteLead);

router.post('/upload', protect, authorize('admin'), upload.single('file'), async (req: any, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  try {
    const io = req.app.get('socketio');
    const count = await processCSV(req.file.path, req.user._id, io);
    res.json({ message: `Successfully uploaded ${count} leads` });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error processing CSV' });
  }
});

export default router;
