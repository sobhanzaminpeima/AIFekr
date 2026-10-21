export class CourseError extends Error {
 constructor(public code:string,public status:number,public required?:number){super(code);}
}
