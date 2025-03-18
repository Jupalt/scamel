# Assembly Line Balancing Program
Optimizes task assignment across stations

## Installation
To install and run the Program for the first time, follow these steps:
1. **Install Python 3.x**
    Check if Python is installed: python3 –version
    Otherwise download python from python.org
2. Optional but highly recommended: **Install Gurobi** as a mathematical Solver
    Go to https://www.gurobi.com and register for a free academic license
    Download and install Gurobi
    To activate your license, run the following in your cmd:
        grbgetkey YOUR_LINCENSE_KEY
3. **Install Git and Clone the Repository**
    Check if Git is installed:
        Open cmd and run: git --version
    If Git is not installed, download it from git-scm.com and install it
    To clone the Repository, run the following in your cmd:
        git clone https://github.com/Jupalt/scamel
        cd scamel
4. **Create and Activate Virtual Environment**
    To create a Virtual Environment, run the following inside the project folder: 
        python3 –m venv venv 
    Activate the Virtual Environment (on Windows): 
        venv\Scripts\Activate
5. **Install Required Dependencies**
    Once the virtual environment is acitve, install all required Python packages:
        pip install –r requirements.txt
6. **Install Gurobi in your Virtual environment**
    If Gurobi was installed, run the following in your cmd:
        pip install gurobipy
7. **Run the Program**
    Run the following in your cmd:
        python main.py or double click on start.bat in your project folder
8. **Open the Web Application**
    Click on the link http://127.0.0.1:8000 in your terminal 