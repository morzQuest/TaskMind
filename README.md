# Supplementary Materials for the Master's Thesis

## Description
The repository includes:

- a compiled Excel workbook containing the processed and pseudonymized data used for the analyses;
- the procedural checklist used to conduct each experimental session;
- a blank version of the participant information and consent form used in the study.

### how to run the code: 
backend: 
 - activate  the environment: .\venv\Scripts\activate
 - then run: uvicorn main:app --reload

(in the browser you can check it: http://127.0.0.1:8000/
for each task: http://127.0.0.1:8000/robot/execute/task_1)

frontend:
 - npm start
 - it will run in a new browser: http://localhost:3000/

(ignore frontend-simplified)
