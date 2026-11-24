import type { Assignment, Family, Parent, Student, Lesson } from './types.ts';
import { assessmentDefinitions, type AssessmentKind } from './assessment-definitions.ts';
export type Assessment = {id:string;student_id:string;kind:AssessmentKind;form_version:number;parent_id:string;submitted_by:string;answers:number[];section_scores:number[];total_score:number;submitted_at:string};
export type WeeklyNote = {id:string;version:number;week_start:string;content:string;updated_by:string;updated_at:string};
export type ConsultationReport = {id:string;version:number;lesson_id:string;participants:string;general:string;theory:string;practice:string;gratitude:string;updated_by:string;updated_at:string};
export type LegacyReport = {week_start:string;published:boolean;goals:string;progress:string;guidance:string;updated_by:string;updated_at:string};
export type LegacyUpdate = {week_start:string;author_id:string;progress:string;challenges:string;practice:string;questions:string;updated_at:string};
export type StudentProfileData = {student:Student;can_edit:boolean;assignments:Assignment[];families:Family[];parents:Parent[];employees:{id:string;name:string;color:string}[];lessons:Lesson[];notes:WeeklyNote[];reports:ConsultationReport[];assessments:Assessment[];authors:{id:string;name:string}[];legacy:{reports:LegacyReport[];updates:LegacyUpdate[];authors:{id:string;name:string}[]}};
export function scoreAssessment(kind:AssessmentKind,answers:number[]) {
 const sections=assessmentDefinitions[kind];
 if(answers.length!==sections.reduce((n,s)=>n+s.questions.length,0))throw Error('Cần trả lời đủ số câu.');
 let offset=0;
 const scores=sections.map(s=>s.questions.reduce(total=>{const choice=answers[offset++];if(!Number.isInteger(choice)||!s.options[choice])throw Error('Lựa chọn không hợp lệ.');return total+s.options[choice].value;},0));
 return {scores,total:scores.reduce((a,b)=>a+b,0)};
}
export function assessmentDue(kind:AssessmentKind,start:string,history:Assessment[],parentId?:string,now=Date.now()) {
 const latest=history.filter(a=>a.kind===kind&&(kind==='atec'||a.parent_id===parentId)).sort((a,b)=>b.submitted_at.localeCompare(a.submitted_at))[0];
 const due=latest?Date.parse(latest.submitted_at)+56*86400000:start?Date.parse(start+'T00:00:00+07:00'):null;
 return {due,overdue:due!==null&&now>=due,latest};
}
export function consultationEligible(l:Lesson){return l.work_kind==='consultation'||l.work_kind==='consultation_therapy'&&Object.values(l.participant_roles||{}).includes('consultation');}
