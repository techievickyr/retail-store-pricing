import { Router } from 'express';
import { requirePathParam } from '../services/http-service';
import { getImportReport } from '../services/import-service';

const router = Router();
router.get('/pricing-imports/:id/report.csv', async (request, response) => {
  const report = await getImportReport(request.user!, requirePathParam(request, 'id'));
  response.type('text/csv').attachment(report.filename).send(report.csv);
});
export default router;
