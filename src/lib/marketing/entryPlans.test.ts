import {beforeEach,describe,it,expect,vi} from 'vitest';
const mocks=vi.hoisted(()=>({rows:[] as Record<string,unknown>[],find:vi.fn(),convert:vi.fn()}));
vi.mock('@/lib/db/prisma',()=>({prisma:{package:{findMany:mocks.find}}}));
vi.mock('@/lib/billing/rates',()=>({currencyConvert:mocks.convert}));
import {getEntryPlans} from './entryPlans';
import {LANDING_PACKAGE_CATEGORIES,packageCategoryLabels} from '@/lib/billing/packageCategories';
beforeEach(()=>{mocks.find.mockReset().mockImplementation(async()=>mocks.rows);mocks.convert.mockReset();mocks.rows=[{planCode:'TEST_CHAT',category:'CHAT_STARTER',name:'گفتگو',nameEn:'Chat',baseCurrency:'IRT',termPrices:'{"monthly":199000}',entitlements:'{"fixedPrices":{"USD":{"monthly":73},"TRY":{"monthly":3660}}}',credits:100,creditAllocation:'TERM',duration:30,features:'آزمایش',featuresEn:'Test',isFeatured:false}];});
describe('shared landing package presentation',()=>{
 it.each([['fa','IRT',199000],['en','USD',73],['de','USD',73],['tr','TRY',3660]] as const)('uses the configured %s retail amount without a separate admin price',async(lang,currency,minor)=>{
  expect((await getEntryPlans(lang))[0]).toMatchObject({currency,minor,credits:100,period:'monthly',days:30});expect(mocks.convert).not.toHaveBeenCalled();
 });
 it('shows the actual quarterly term, total credits and amount rather than hiding the package',async()=>{
  mocks.rows[0]={...mocks.rows[0],category:'STUDENT',termPrices:'{"quarterly":450000}',creditAllocation:'MONTHLY_TOTAL',duration:90};
  expect((await getEntryPlans('fa'))[0]).toMatchObject({period:'quarterly',minor:450000,days:90,credits:300});
 });
 it('uses the central category allowlist and excludes the superseded offer',async()=>{
  await getEntryPlans('fa');expect(mocks.find.mock.calls[0][0].where).toMatchObject({category:{in:LANDING_PACKAGE_CATEGORIES},planCode:{notIn:['CHAT_STARTER_30']}});
  expect(packageCategoryLabels('fa').VIDEO_FACTORY).toBe('تولید محتوا');
 });
});
