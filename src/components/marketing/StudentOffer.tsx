"use client";import DynamicPlans from "@/components/billing/DynamicPlans";import type {Lang} from "@/lib/i18n/server";
export type StudentPackage={planCode:string;price:number;priceUsd:number|null;credits:number;priceTry?:number|null;usdAmount?:number;monthlyPackage?:StudentPackage|null;usdToTry?:number;rateDate?:string;isFallback?:boolean};
export default function StudentOffer(_props:{lang:Lang;plan:StudentPackage|null;onBuy?:()=>void;busy?:boolean}){return <DynamicPlans key={_props.lang} category="STUDENT"/>;}
