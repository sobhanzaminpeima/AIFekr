import {describe,it,expect} from "vitest";
import {academyQuestion,answerCorrect,answerValid,publicQuestion} from "./assessment";
describe("academy assessment grading",()=>{
 const common={question:"Which answer is correct?",explanation:"Explanation"};
 it("grades multiple selections without depending on selection order",()=>{const q=academyQuestion.parse({...common,type:"multipleSelect",options:["A","B","C"],correctIndices:[0,2]});expect(answerCorrect(q,[2,0])).toBe(true);expect(answerCorrect(q,[0])).toBe(false);expect(answerValid(q,[0,0])).toBe(false);});
 it("normalizes short answers without invoking AI",()=>{const q=academyQuestion.parse({...common,type:"shortAnswer",acceptedAnswers:["React Hooks"]});expect(answerCorrect(q," react   hooks ")).toBe(true);expect(answerCorrect(q,"Vue")).toBe(false);});
 it("grades boolean answers strictly",()=>{const q=academyQuestion.parse({...common,type:"trueFalse",correct:false});expect(answerCorrect(q,false)).toBe(true);expect(answerCorrect(q,0)).toBe(false);});
 it.each(["ordering","matching"])("requires complete valid %s mappings",type=>{const q=academyQuestion.parse({...common,type,...(type==="ordering"?{items:["A","B"],correctOrder:[1,0]}:{left:["A","B"],right:["One","Two"],correctMatches:[1,0]})});expect(answerCorrect(q,[1,0])).toBe(true);expect(answerCorrect(q,[0,1])).toBe(false);expect(answerValid(q,[-1,0])).toBe(false);});
 it("rejects malformed answer keys and strips all keys from public questions",()=>{expect(academyQuestion.safeParse({...common,type:"multipleChoice",options:["A","B"],correctIndex:2}).success).toBe(false);const q=academyQuestion.parse({...common,type:"shortAnswer",acceptedAnswers:["secret"]});expect(JSON.stringify(publicQuestion(q))).not.toContain("secret");expect(publicQuestion(q)).not.toHaveProperty("explanation");});
});
