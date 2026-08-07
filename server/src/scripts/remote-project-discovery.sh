#!/bin/bash
ssh -p "$SERVER_PORT" "$SERVER_USER@$SERVER_HOST" "python3 -s" <<'PYTHON_SCRIPT'
import os
import re
import csv
import io
import subprocess
from urllib.parse import urlparse, unquote

NGINX_DIR = "/etc/nginx/sites-available"
VAR_WWW = "/var/www"

def run_cmd(cmd):
    try:
        return subprocess.check_output(cmd, shell=True, text=True, stderr=subprocess.DEVNULL)
    except:
        return ""

def read_file(path):
    try:
        with open(path, "r", errors="ignore") as f:
            return f.read()
    except:
        return ""

def print_csv(title, rows, fields):
    print(f"\n================ {title} ================\n")
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=fields)
    writer.writeheader()
    writer.writerows(rows)
    print(output.getvalue())

def clean_lines(content):
    result = []
    for line in content.splitlines():
        line = line.strip()
        if line and not line.startswith("//") and not line.startswith("#"):
            result.append(line)
    return result

def get_domain_and_port(nginx_file):
    content = read_file(nginx_file)

    domain = ""
    port = ""

    m = re.search(r"server_name\s+([^;]+);", content)
    if m:
        domain = m.group(1).strip().split()[0]

    m = re.search(r"proxy_pass\s+http[s]?://(?:localhost|127\.0\.0\.1|0\.0\.0\.0):(\d+)", content)
    if m:
        port = m.group(1)

    return domain, port

def extract_value(line):
    line = line.strip().rstrip(";")
    if "=" not in line:
        return ""
    return line.split("=", 1)[1].strip().strip('"').strip("'").strip()

def parse_mongo_url(url):
    parsed = urlparse(url)
    return {
        "db_user": unquote(parsed.username or ""),
        "db_name": parsed.path.replace("/", "").strip(),
        "db_type": "MongoDB",
        "db_host": parsed.hostname or "",
        "db_port": str(parsed.port or ""),
    }

def find_db(project_path):
    files_to_check = []

    for file in [".env", ".env.production", "server-start.js"]:
        p = os.path.join(project_path, file)
        if os.path.isfile(p):
            files_to_check.append(p)

    server_dir = os.path.join(project_path, "server")
    if os.path.isdir(server_dir):
        for file in [".env", ".env.production", "server-start.js"]:
            p = os.path.join(server_dir, file)
            if os.path.isfile(p):
                files_to_check.append(p)

    candidates = []

    for file in files_to_check:
        content = read_file(file)

        for line in clean_lines(content):
            if re.search(r"\b(MONGO_HOST|MONGO_URI|MONGODB_URI)\b", line):
                value = extract_value(line)

                if value.startswith("mongodb://") or value.startswith("mongodb+srv://"):
                    parsed = parse_mongo_url(value)
                    parsed["config_file"] = file

                    if parsed["db_host"] not in ["localhost", "127.0.0.1"]:
                        return parsed

                    candidates.append(parsed)

            elif re.search(r"\b(DB_NAME|DATABASE_NAME)\b", line):
                value = extract_value(line)
                candidates.append({
                    "db_user": "",
                    "db_name": value,
                    "db_type": "DB_NAME",
                    "db_host": "",
                    "db_port": "",
                    "config_file": file
                })

    if candidates:
        return candidates[0]

    return {
        "db_user": "",
        "db_name": "",
        "db_type": "",
        "db_host": "",
        "db_port": "",
        "config_file": ""
    }

def possible_project_paths(domain, nginx_name, port):
    paths = [
        f"{VAR_WWW}/{domain}",
        f"{VAR_WWW}/{domain}/server",
        f"{VAR_WWW}/{nginx_name}",
        f"{VAR_WWW}/{nginx_name}/server",
    ]

    for root, dirs, files in os.walk(VAR_WWW):
        depth = root.count(os.sep) - VAR_WWW.count(os.sep)
        if depth > 3:
            continue

        for file in files:
            if file in [".env", ".env.production", "server-start.js"]:
                full = os.path.join(root, file)
                content = read_file(full)

                if re.search(rf"(SERVER_PORT|PORT)\s*=\s*[\"']?{port}[\"']?", content):
                    paths.insert(0, root)

    unique = []
    for p in paths:
        if p and os.path.isdir(p) and p not in unique:
            unique.append(p)

    return unique

def get_all_running_ports():
    rows = []

    output = run_cmd("lsof -iTCP -sTCP:LISTEN -P -n")

    for line in output.splitlines():
        if line.startswith("COMMAND"):
            continue

        parts = line.split()
        if len(parts) < 9:
            continue

        name = " ".join(parts[8:])
        port_match = re.search(r":(\d+)\s+\(LISTEN\)", name)

        if not port_match:
            continue

        pid = parts[1]
        project_path = run_cmd(f"readlink -f /proc/{pid}/cwd").strip()

        rows.append({
            "Port": port_match.group(1),
            "Command": parts[0],
            "PID": pid,
            "User": parts[2],
            "Name": name,
            "Project_Path": project_path,
            "Status": "USED"
        })

    if rows:
        return sorted(rows, key=lambda x: int(x["Port"]))

    # fallback using ss if lsof gives empty
    ss_output = run_cmd("ss -ltnp")

    for line in ss_output.splitlines():
        if "LISTEN" not in line:
            continue

        parts = line.split()
        if len(parts) < 4:
            continue

        local_address = parts[3]
        port_match = re.search(r":(\d+)$", local_address)

        if not port_match:
            continue

        pid = ""
        command = ""

        pid_match = re.search(r"pid=(\d+)", line)
        if pid_match:
            pid = pid_match.group(1)

        cmd_match = re.search(r'users:\(\("([^"]+)"', line)
        if cmd_match:
            command = cmd_match.group(1)

        project_path = ""
        if pid:
            project_path = run_cmd(f"readlink -f /proc/{pid}/cwd").strip()

        rows.append({
            "Port": port_match.group(1),
            "Command": command,
            "PID": pid,
            "User": "",
            "Name": local_address + " (LISTEN)",
            "Project_Path": project_path,
            "Status": "USED"
        })

    return sorted(rows, key=lambda x: int(x["Port"]))

project_rows = []

for nginx_name in os.listdir(NGINX_DIR):
    nginx_file = os.path.join(NGINX_DIR, nginx_name)

    if not os.path.isfile(nginx_file):
        continue

    domain, port = get_domain_and_port(nginx_file)

    if not domain or not port:
        continue

    project_path = ""

    db = {
        "db_user": "",
        "db_name": "",
        "db_type": "",
        "db_host": "",
        "db_port": "",
        "config_file": ""
    }

    for path in possible_project_paths(domain, nginx_name, port):
        found_db = find_db(path)
        project_path = path

        if found_db["db_name"] or found_db["db_host"]:
            db = found_db
            break

    project_rows.append({
        "Domain": domain,
        "Port": port,
        "Project_Path": project_path,
        "DB_User": db["db_user"],
        "DB_Name": db["db_name"],
        "DB_Type": db["db_type"],
        "DB_Host": db["db_host"],
        "DB_Port": db["db_port"],
        "Config_File": db["config_file"],
        "Status": "DB_FOUND" if db["db_name"] else "DB_NOT_FOUND",
        "Nginx_File": nginx_file
    })

port_rows = get_all_running_ports()

print_csv(
    "DOMAIN + PROJECT + DB REPORT",
    project_rows,
    [
        "Domain",
        "Port",
        "Project_Path",
        "DB_User",
        "DB_Name",
        "DB_Type",
        "DB_Host",
        "DB_Port",
        "Config_File",
        "Status",
        "Nginx_File"
    ]
)

print_csv(
    "ALL USED / RUNNING PORTS REPORT",
    port_rows,
    [
        "Port",
        "Command",
        "PID",
        "User",
        "Name",
        "Project_Path",
        "Status"
    ]
)

print("\n================ SUMMARY ================\n")
print(f"Total nginx domain ports: {len(project_rows)}")
print(f"DB found: {len([x for x in project_rows if x['Status'] == 'DB_FOUND'])}")
print(f"DB not found: {len([x for x in project_rows if x['Status'] == 'DB_NOT_FOUND'])}")
print(f"Total used/listening ports: {len(port_rows)}")
PYTHON_SCRIPT
