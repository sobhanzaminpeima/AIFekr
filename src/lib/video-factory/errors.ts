export class FactoryError extends Error {
 /** `details` holds non-sensitive numbers the client needs to recover (e.g. the credits a budget cap must cover). */
 constructor(public code:string,public status=409,public details?:Record<string,number>){super(code);}
}
