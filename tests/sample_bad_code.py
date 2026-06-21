import os

password = "admin123"  # hardcoded secret

def run_command(user_input):
    os.system(user_input)  # command injection risk

def complex_function(a, b, c, d):
    if a:
        if b:
            if c:
                if d:
                    return 1
                else:
                    return 2
            else:
                return 3
        else:
            return 4
    else:
        return 5