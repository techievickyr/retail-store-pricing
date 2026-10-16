import { Router } from 'express';
import { searchPrices, type PriceSearchInput } from '../services/pricing-service';

const router = Router();
router.get('/prices', async (request, response) => {
  const queryValue = (key: keyof PriceSearchInput): string | undefined => request.query[key] === undefined ? undefined : String(request.query[key]);
  const input: PriceSearchInput = {
    page: queryValue('page'),
    pageSize: queryValue('pageSize'),
    sort: queryValue('sort'),
    direction: queryValue('direction'),
    storeId: queryValue('storeId'),
    sku: queryValue('sku'),
    productName: queryValue('productName'),
    minPrice: queryValue('minPrice'),
    maxPrice: queryValue('maxPrice'),
    currency: queryValue('currency'),
    effectiveDate: queryValue('effectiveDate'),
    fromDate: queryValue('fromDate'),
    toDate: queryValue('toDate'),
  };
  response.json(await searchPrices(request.user!, input));
});
export default router;
