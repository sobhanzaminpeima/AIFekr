export async function factoryApi<T>(url:string,data?:unknown,method="POST"):Promise<T>{
  const response=await fetch(url,data===undefined?{cache:"no-store"}:{method,headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});
  const value=await response.json();if(!response.ok)throw new Error(value.code || value.error || "REQUEST_FAILED");return value as T;
}
