import {describe,it,expect} from "vitest";
import {packageUsdPrice,convertedPackage} from "./packagePricing";
const rates={usdToToman:160000,usdToTry:40,usdToEur:.9};
describe("canonical currency bases",()=>{
 it("keeps a TRY base exact while dollar and Toman follow changing daily rates",()=>{
  const p={price:1,priceUsd:8000,priceTry:119999};
  expect(packageUsdPrice(p,rates)).toBe(1199.99/40);
  expect(convertedPackage(p,rates)).toMatchObject({liraAmount:1199.99,price:47999600,priceUsd:3000});
  const next=convertedPackage(p,{...rates,usdToTry:50,usdToToman:170000});
  expect(next.liraAmount).toBe(1199.99);expect(next.usdAmount).toBe(1199.99/50);expect(next.price).toBe(Math.round(1199.99/50*170000)*10);
 });
 it("converts existing USD and Rial bases without overriding them",()=>{
  expect(packageUsdPrice({price:100,priceUsd:1900},rates)).toBe(19);
  expect(packageUsdPrice({price:16000000,priceUsd:null},rates)).toBe(10);
 });
});
