// Local visual fixture only. No production users, credentials or paid requests.
import React from "react";
import {createRoot} from "react-dom/client";
import VoiceStudio from "../src/components/voice-studio/VoiceStudio";
import {LangProvider} from "../src/lib/i18n/LangProvider";
import {defaults} from "../src/lib/voice-studio/domain";
const language=new URLSearchParams(location.search).get("lang")==="en"?"en":"fa";
document.documentElement.lang=language;document.documentElement.dir=language==="fa"?"rtl":"ltr";
const project={id:"visual-fixture",name:language==="fa"?"گویندگی معرفی محصول":"Product introduction",text:language==="fa"?"به استودیوی صدای ای‌آی فکر خوش آمدید. متن خود را وارد کنید و صدای موردنظرتان را انتخاب کنید.":"Welcome to AIFekr Voice Studio. Enter your text and choose a voice.",language,archivedAt:null};
window.fetch=async(input,init)=>{const url=String(input);if(init?.method==="POST")return Response.json({project,presets:[]});if(url.includes("project="))return Response.json({generations:[]});return Response.json({policy:{...defaults,enabled:false,allowedModels:["fixture-model"]},credits:450,projects:[project],presets:[],catalogError:null,catalog:{fetchedAt:new Date().toISOString(),models:[{id:"fixture-model",name:"Preview model",languages:[{id:"fa",name:"فارسی"},{id:"en",name:"English"}],maxCharacters:5000,style:true,speakerBoost:true}],voices:[{id:"fixture-voice",name:"Preview narrator",labels:{gender:"female",accent:"neutral",description:"Warm narration"},preview:null}]}});};
createRoot(document.getElementById("root")!).render(<LangProvider lang={language}><VoiceStudio/></LangProvider>);
