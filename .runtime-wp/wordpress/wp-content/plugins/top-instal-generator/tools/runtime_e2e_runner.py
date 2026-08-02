import cgi
import html
import io
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Dict, Any, Optional, Tuple

WP_ROOT = Path(r"C:/Users/compg/Desktop/kalk-top/.runtime-wp/wordpress")
PLUGIN_ROOT = Path(r"C:/Users/compg/Desktop/top-instal-generator")
DOCS_DIR = PLUGIN_ROOT / "docs"
BASE_URL = "http://127.0.0.1:8090"
AJAX_URL = BASE_URL + "/wp-admin/admin-ajax.php"
REST_URL = BASE_URL + "/wp-json/topinstal/v1/offer-documents/generate"
CONVERTER_URL = "http://127.0.0.1:8091/forms/libreoffice/convert"
CONVERTER_TOKEN = "runtime-converter-token"


@dataclass
class HttpResult:
    status: int
    headers: Dict[str, str]
    body_text: str
    body_bytes: bytes


class RuntimeErrorWithOutput(Exception):
    pass


def run_php(code: str, extra_env: Optional[Dict[str, str]] = None) -> str:
    script = WP_ROOT / "_runtime_exec.php"
    script.write_text(code, encoding="utf-8")
    env = os.environ.copy()
    if extra_env:
        env.update(extra_env)
    proc = subprocess.run(
        ["php", str(script)],
        cwd=str(WP_ROOT),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        env=env,
        check=False,
    )
    if proc.returncode != 0:
        raise RuntimeErrorWithOutput(f"PHP script failed ({proc.returncode}):\n{proc.stdout}")
    return proc.stdout


def configure_wp(agent_key: str, converter_url: str, converter_token: str) -> str:
    code = f"""<?php
require_once __DIR__ . '/wp-load.php';
require_once ABSPATH . 'wp-admin/includes/plugin.php';
if (!is_plugin_active('sqlite-database-integration/load.php')) {{
    activate_plugin('sqlite-database-integration/load.php');
}}
if (!is_plugin_active('top-instal-generator/top-instal-generator.php')) {{
    activate_plugin('top-instal-generator/top-instal-generator.php');
}}
update_option('siteurl', '{BASE_URL}');
update_option('home', '{BASE_URL}');
update_option('top_instal_agent_api_key', '{agent_key}');
update_option('top_instal_pdf_converter_url', '{converter_url}');
update_option('top_instal_pdf_converter_token', '{converter_token}');
update_option('top_instal_pdf_debug_log', 1);
flush_rewrite_rules();
echo 'NONCE=' . wp_create_nonce('top_instal_nonce') . "\\n";
echo 'AGENT_KEY=' . get_option('top_instal_agent_api_key', '') . "\\n";
?>"""
    out = run_php(code)
    nonce_match = re.search(r"NONCE=([a-zA-Z0-9]+)", out)
    if not nonce_match:
        raise RuntimeErrorWithOutput(f"Could not read nonce from configure output:\n{out}")
    return nonce_match.group(1)


def get_wp_hook_map() -> Dict[str, Any]:
    code = """<?php
require_once __DIR__ . '/wp-load.php';
global $wp_filter;
$targets = array('wp_ajax_get_kits', 'wp_ajax_simple_generate', 'rest_api_init');
$out = array();
foreach ($targets as $hook) {
    $callbacks = array();
    if (isset($wp_filter[$hook])) {
        $obj = $wp_filter[$hook];
        if (is_object($obj) && isset($obj->callbacks) && is_array($obj->callbacks)) {
            foreach ($obj->callbacks as $priority => $fns) {
                foreach ($fns as $entry) {
                    $name = '';
                    $cb = isset($entry['function']) ? $entry['function'] : null;
                    if (is_string($cb)) {
                        $name = $cb;
                    } elseif (is_array($cb) && count($cb) === 2) {
                        $left = is_object($cb[0]) ? get_class($cb[0]) : (string) $cb[0];
                        $name = $left . '::' . (string)$cb[1];
                    } else {
                        $name = 'closure-or-unknown';
                    }
                    $callbacks[] = array('priority' => (int)$priority, 'callback' => $name);
                }
            }
        }
    }
    $out[$hook] = $callbacks;
}
$out['class_exists'] = array(
    'TopInstal_Ajax_Kits_Controller' => class_exists('TopInstal_Ajax_Kits_Controller'),
    'TopInstal_Ajax_GenerateOfferDocument_Controller' => class_exists('TopInstal_Ajax_GenerateOfferDocument_Controller'),
    'TopInstal_GenerateOfferDocument_UseCase' => class_exists('TopInstal_GenerateOfferDocument_UseCase')
);
echo json_encode($out, JSON_PRETTY_PRINT);
?>"""
    out = run_php(code)
    return json.loads(out)


def start_wp_server(extra_env: Optional[Dict[str, str]] = None):
    log_path = WP_ROOT / "_wp_server.log"
    log_file = open(log_path, "w", encoding="utf-8")
    router_path = WP_ROOT / "_router.php"
    router_path.write_text(
        """<?php
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$full = __DIR__ . $path;
if ($path !== '/' && file_exists($full) && !is_dir($full)) {
    return false;
}
if (strpos($path, '/wp-json/') === 0) {
    $_GET['rest_route'] = '/' . ltrim(substr($path, 8), '/');
    $_SERVER['PATH_INFO'] = '/' . ltrim(substr($path, 8), '/');
}
require __DIR__ . '/index.php';
""",
        encoding="utf-8",
    )
    env = os.environ.copy()
    if extra_env:
        env.update(extra_env)
    proc = subprocess.Popen(
        ["php", "-S", "127.0.0.1:8090", str(router_path)],
        cwd=str(WP_ROOT),
        stdout=log_file,
        stderr=subprocess.STDOUT,
        env=env,
    )
    deadline = time.time() + 30
    last_err = None
    while time.time() < deadline:
        try:
            res = http_request("GET", BASE_URL + "/wp-json/")
            if res.status == 200:
                return proc, log_path
        except Exception as exc:  # pragma: no cover
            last_err = exc
        time.sleep(0.5)
    proc.terminate()
    raise RuntimeErrorWithOutput(f"WordPress server did not start: {last_err}")


def stop_server(proc):
    if proc and proc.poll() is None:
        proc.terminate()
        try:
            proc.wait(timeout=8)
        except subprocess.TimeoutExpired:
            proc.kill()


def http_request(method: str, url: str, headers: Optional[Dict[str, str]] = None, data: Optional[bytes] = None) -> HttpResult:
    req = urllib.request.Request(url=url, data=data, method=method)
    headers = headers or {}
    for k, v in headers.items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            body = resp.read()
            return HttpResult(resp.status, {k.lower(): v for k, v in resp.headers.items()}, body.decode("utf-8", errors="replace"), body)
    except urllib.error.HTTPError as e:
        body = e.read()
        return HttpResult(e.code, {k.lower(): v for k, v in e.headers.items()}, body.decode("utf-8", errors="replace"), body)


def post_form(url: str, form: Dict[str, Any], headers: Optional[Dict[str, str]] = None) -> HttpResult:
    encoded = urllib.parse.urlencode(form).encode("utf-8")
    h = {"Content-Type": "application/x-www-form-urlencoded"}
    if headers:
        h.update(headers)
    return http_request("POST", url, headers=h, data=encoded)


def post_json(url: str, payload: Dict[str, Any], headers: Optional[Dict[str, str]] = None) -> HttpResult:
    data = json.dumps(payload).encode("utf-8")
    h = {"Content-Type": "application/json"}
    if headers:
        h.update(headers)
    return http_request("POST", url, headers=h, data=data)


def parse_json(text: str) -> Dict[str, Any]:
    return json.loads(text)


def extract_docx_text(docx_bytes: bytes) -> str:
    try:
        with zipfile.ZipFile(io.BytesIO(docx_bytes)) as zf:
            xml = zf.read("word/document.xml").decode("utf-8", errors="ignore")
        parts = re.findall(r"<w:t[^>]*>(.*?)</w:t>", xml)
        plain = " ".join(html.unescape(p) for p in parts)
        plain = re.sub(r"\s+", " ", plain).strip()
        return plain[:500] if plain else "DOCX without text"
    except Exception:
        return "DOCX parse failed"


def pdf_escape(text: str) -> str:
    return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def make_simple_pdf(text: str) -> bytes:
    stream = f"BT /F1 11 Tf 40 760 Td ({pdf_escape(text[:200])}) Tj ET\n"
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
        f"<< /Length {len(stream.encode('latin-1', errors='replace'))} >>\nstream\n{stream}endstream".encode("latin-1", errors="replace"),
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    out = io.BytesIO()
    out.write(b"%PDF-1.4\n")
    xref_positions = [0]
    for i, obj in enumerate(objects, 1):
        xref_positions.append(out.tell())
        out.write(f"{i} 0 obj\n".encode("ascii"))
        out.write(obj)
        out.write(b"\nendobj\n")
    xref_start = out.tell()
    out.write(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
    out.write(b"0000000000 65535 f \n")
    for pos in xref_positions[1:]:
        out.write(f"{pos:010d} 00000 n \n".encode("ascii"))
    out.write(f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_start}\n%%EOF\n".encode("ascii"))
    return out.getvalue()


class ConverterHandler(BaseHTTPRequestHandler):
    token = CONVERTER_TOKEN

    def do_POST(self):
        if self.path != "/forms/libreoffice/convert":
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b"not found")
            return

        incoming = self.headers.get("X-Converter-Token", "")
        if incoming != self.token:
            self.send_response(403)
            self.end_headers()
            self.wfile.write(b"bad token")
            return

        ctype, _ = cgi.parse_header(self.headers.get("content-type", ""))
        if ctype != "multipart/form-data":
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b"multipart required")
            return

        fs = cgi.FieldStorage(
            fp=self.rfile,
            headers=self.headers,
            environ={
                "REQUEST_METHOD": "POST",
                "CONTENT_TYPE": self.headers.get("content-type"),
            },
        )
        if "files" not in fs:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b"files field required")
            return

        item = fs["files"]
        docx_bytes = item.file.read() if getattr(item, "file", None) else b""
        text = extract_docx_text(docx_bytes)
        pdf = make_simple_pdf(f"Converted from DOCX: {text}")

        self.send_response(200)
        self.send_header("Content-Type", "application/pdf")
        self.send_header("Content-Length", str(len(pdf)))
        self.end_headers()
        self.wfile.write(pdf)

    def log_message(self, fmt: str, *args):
        return


def start_converter_server():
    server = ThreadingHTTPServer(("127.0.0.1", 8091), ConverterHandler)
    import threading

    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server


def fetch_binary(url: str) -> HttpResult:
    return http_request("GET", url)


def build_rest_payload(kit_model: str, output_format: str, trace_id: str) -> Dict[str, Any]:
    return {
        "schemaVersion": "1.0",
        "traceId": trace_id,
        "mode": "direct-config",
        "documentType": "offer_document",
        "outputFormat": output_format,
        "payload": {
            "installationType": "heat_pump",
            "kitModel": kit_model,
            "powerKw": 7,
            "tank": {
                "enabled": True,
                "capacity": "200",
                "manufacturer": "Trinnity",
            },
            "buffer": {
                "enabled": False,
                "capacity": "none",
            },
            "pricing": {
                "customPriceGross": 41000,
            },
        },
        "context": {
            "source": "runtime-e2e",
            "channel": "qa-script",
        },
    }


def main():
    results: Dict[str, Any] = {
        "environment": {
            "wp_root": str(WP_ROOT),
            "base_url": BASE_URL,
            "rest_url": REST_URL,
            "ajax_url": AJAX_URL,
        },
        "tests": {},
    }

    # Phase 1: normal runtime with option-based agent key
    nonce = configure_wp(agent_key="test-agent-key-123", converter_url="", converter_token="")
    hook_map = get_wp_hook_map()
    results["hook_map"] = hook_map

    wp_proc = None
    converter_server = None
    wp_log = None
    try:
        wp_proc, wp_log = start_wp_server()

        # get_kits success
        kits_req = {
            "action": "get_kits",
            "nonce": nonce,
            "power_type": "all",
            "tank_capacity": "200",
            "power_kw": "7",
        }
        kits_res = post_form(AJAX_URL, kits_req)
        kits_json = parse_json(kits_res.body_text)
        kits_map = kits_json.get("data") if isinstance(kits_json, dict) else {}
        first_kit = ""
        if isinstance(kits_map, dict) and kits_map:
            first_kit = sorted(kits_map.keys())[0]
        results["tests"]["legacy_get_kits"] = {
            "request": kits_req,
            "status": kits_res.status,
            "response": kits_json,
            "pass": bool(kits_res.status == 200 and kits_json.get("success") is True and isinstance(kits_map, dict) and len(kits_map) > 0),
            "selectedKit": first_kit,
        }

        # get_kits empty marker (delegation evidence)
        kits_empty_req = {
            "action": "get_kits",
            "nonce": nonce,
            "power_type": "all",
            "tank_capacity": "200",
            "power_kw": "999",
        }
        kits_empty_res = post_form(AJAX_URL, kits_empty_req)
        kits_empty_json = parse_json(kits_empty_res.body_text)
        results["tests"]["legacy_get_kits_empty"] = {
            "request": kits_empty_req,
            "status": kits_empty_res.status,
            "response": kits_empty_json,
            "delegationMarker": "Nie znaleziono zestawow dla podanych filtrow." in kits_empty_res.body_text,
        }

        if not first_kit:
            raise RuntimeErrorWithOutput("No kit found from get_kits response.")

        # legacy simple_generate docx
        simple_payload_docx = {
            "installation_type": "heat_pump",
            "power_kw": "7",
            "has_cwu": "1",
            "tank_capacity": "200",
            "tank_manufacturer": "Trinnity",
            "has_buffer": "0",
            "buffer_capacity": "none",
            "kit_model": first_kit,
            "custom_price": "41000",
            "output_format": "docx",
        }
        simple_docx_req = {
            "action": "simple_generate",
            "nonce": nonce,
            "data": json.dumps(simple_payload_docx),
        }
        simple_docx_res = post_form(AJAX_URL, simple_docx_req)
        simple_docx_json = parse_json(simple_docx_res.body_text)
        legacy_docx_url = ""
        legacy_docx_filename = ""
        if isinstance(simple_docx_json, dict) and simple_docx_json.get("success"):
            data = simple_docx_json.get("data", {})
            if isinstance(data, dict):
                legacy_docx_url = str(data.get("download_url", ""))
                legacy_docx_filename = str(data.get("filename", ""))
        legacy_docx_download = fetch_binary(legacy_docx_url) if legacy_docx_url else HttpResult(0, {}, "", b"")
        results["tests"]["legacy_simple_generate_docx"] = {
            "request": simple_payload_docx,
            "status": simple_docx_res.status,
            "response": simple_docx_json,
            "downloadStatus": legacy_docx_download.status,
            "downloadBytes": len(legacy_docx_download.body_bytes),
            "docxMagic": legacy_docx_download.body_bytes[:2].decode("latin-1", errors="ignore"),
            "pass": bool(
                simple_docx_res.status == 200
                and simple_docx_json.get("success") is True
                and legacy_docx_filename.endswith(".docx")
                and legacy_docx_url.startswith(BASE_URL)
                and legacy_docx_download.status == 200
                and legacy_docx_download.body_bytes.startswith(b"PK")
            ),
        }

        # legacy invalid JSON marker (delegation evidence)
        invalid_simple_req = {
            "action": "simple_generate",
            "nonce": nonce,
            "data": "not-json",
        }
        invalid_simple_res = post_form(AJAX_URL, invalid_simple_req)
        invalid_simple_json = parse_json(invalid_simple_res.body_text)
        results["tests"]["legacy_simple_generate_invalid_json"] = {
            "status": invalid_simple_res.status,
            "response": invalid_simple_json,
            "delegationMarker": bool(
                isinstance(invalid_simple_json, dict)
                and invalid_simple_json.get("success") is False
                and isinstance(invalid_simple_json.get("data"), dict)
                and invalid_simple_json["data"].get("errorCode") == "VALIDATION_ERROR"
                and invalid_simple_json["data"].get("message") == "Invalid JSON input."
            ),
        }

        # REST no auth
        rest_payload_docx = build_rest_payload(first_kit, "docx", "trace-rest-no-auth")
        rest_no_auth_res = post_json(REST_URL, rest_payload_docx)
        rest_no_auth_json = parse_json(rest_no_auth_res.body_text)
        results["tests"]["rest_no_auth"] = {
            "status": rest_no_auth_res.status,
            "response": rest_no_auth_json,
            "pass": bool(rest_no_auth_res.status == 401 and rest_no_auth_json.get("errorCode") == "AUTH_REQUIRED"),
        }

        # REST bad key
        rest_bad_key_res = post_json(REST_URL, rest_payload_docx, headers={"X-Top-Instal-Agent-Key": "wrong-key"})
        rest_bad_key_json = parse_json(rest_bad_key_res.body_text)
        results["tests"]["rest_bad_key"] = {
            "status": rest_bad_key_res.status,
            "response": rest_bad_key_json,
            "pass": bool(rest_bad_key_res.status == 403 and rest_bad_key_json.get("errorCode") == "AGENT_KEY_INVALID"),
        }

        # REST validation error (with valid auth)
        invalid_payload = {
            "traceId": "trace-validation",
            "payload": {},
            "outputFormat": "docx",
        }
        rest_validation_res = post_json(REST_URL, invalid_payload, headers={"X-Top-Instal-Agent-Key": "test-agent-key-123"})
        rest_validation_json = parse_json(rest_validation_res.body_text)
        results["tests"]["rest_validation"] = {
            "status": rest_validation_res.status,
            "response": rest_validation_json,
            "pass": bool(
                rest_validation_res.status == 400
                and rest_validation_json.get("errorCode") == "VALIDATION_ERROR"
                and isinstance(rest_validation_json.get("details", {}).get("errors"), list)
            ),
        }

        # REST success via nonce
        rest_payload_nonce = build_rest_payload(first_kit, "docx", "trace-rest-nonce")
        rest_nonce_res = post_json(REST_URL, rest_payload_nonce, headers={"X-Topinstal-Nonce": nonce})
        rest_nonce_json = parse_json(rest_nonce_res.body_text)
        rest_nonce_url = rest_nonce_json.get("document", {}).get("downloadUrl", "") if isinstance(rest_nonce_json, dict) else ""
        rest_nonce_download = fetch_binary(rest_nonce_url) if rest_nonce_url else HttpResult(0, {}, "", b"")
        results["tests"]["rest_nonce_success"] = {
            "status": rest_nonce_res.status,
            "headers": rest_nonce_res.headers,
            "response": rest_nonce_json,
            "downloadStatus": rest_nonce_download.status,
            "pass": bool(
                rest_nonce_res.status == 200
                and rest_nonce_json.get("status") == "success"
                and rest_nonce_json.get("traceId") == "trace-rest-nonce"
                and rest_nonce_json.get("document", {}).get("filename", "").endswith(".docx")
                and rest_nonce_download.status == 200
            ),
        }

        # REST success via agent key
        rest_payload_key = build_rest_payload(first_kit, "docx", "trace-rest-agent")
        rest_key_res = post_json(REST_URL, rest_payload_key, headers={"X-Top-Instal-Agent-Key": "test-agent-key-123"})
        rest_key_json = parse_json(rest_key_res.body_text)
        results["tests"]["rest_agent_key_success"] = {
            "status": rest_key_res.status,
            "headers": rest_key_res.headers,
            "response": rest_key_json,
            "pass": bool(
                rest_key_res.status == 200
                and rest_key_json.get("status") == "success"
                and rest_key_json.get("traceId") == "trace-rest-agent"
            ),
        }

        # Agent key rotation test (read+use of option)
        rotate_nonce = configure_wp(agent_key="rotated-agent-key-456", converter_url="", converter_token="")
        rest_after_rotate_old = post_json(REST_URL, build_rest_payload(first_kit, "docx", "trace-rotate-old"), headers={"X-Top-Instal-Agent-Key": "test-agent-key-123"})
        rest_after_rotate_old_json = parse_json(rest_after_rotate_old.body_text)
        rest_after_rotate_new = post_json(REST_URL, build_rest_payload(first_kit, "docx", "trace-rotate-new"), headers={"X-Top-Instal-Agent-Key": "rotated-agent-key-456"})
        rest_after_rotate_new_json = parse_json(rest_after_rotate_new.body_text)
        results["tests"]["agent_key_option_rotation"] = {
            "rotateNonce": rotate_nonce,
            "oldKeyStatus": rest_after_rotate_old.status,
            "oldKeyResponse": rest_after_rotate_old_json,
            "newKeyStatus": rest_after_rotate_new.status,
            "newKeyResponse": rest_after_rotate_new_json,
            "pass": bool(
                rest_after_rotate_old.status == 403
                and rest_after_rotate_old_json.get("errorCode") == "AGENT_KEY_INVALID"
                and rest_after_rotate_new.status == 200
                and rest_after_rotate_new_json.get("status") == "success"
            ),
        }

        # Enable converter and run true PDF path for REST + legacy
        converter_server = start_converter_server()
        nonce_pdf = configure_wp(agent_key="rotated-agent-key-456", converter_url=CONVERTER_URL, converter_token=CONVERTER_TOKEN)

        rest_pdf_payload = build_rest_payload(first_kit, "pdf", "trace-rest-pdf")
        rest_pdf_res = post_json(REST_URL, rest_pdf_payload, headers={"X-Top-Instal-Agent-Key": "rotated-agent-key-456"})
        rest_pdf_json = parse_json(rest_pdf_res.body_text)
        rest_pdf_url = rest_pdf_json.get("document", {}).get("downloadUrl", "") if isinstance(rest_pdf_json, dict) else ""
        rest_pdf_file = fetch_binary(rest_pdf_url) if rest_pdf_url else HttpResult(0, {}, "", b"")
        results["tests"]["rest_pdf_conversion"] = {
            "status": rest_pdf_res.status,
            "response": rest_pdf_json,
            "downloadStatus": rest_pdf_file.status,
            "pdfMagic": rest_pdf_file.body_bytes[:5].decode("latin-1", errors="ignore"),
            "pdfBytes": len(rest_pdf_file.body_bytes),
            "pass": bool(
                rest_pdf_res.status == 200
                and rest_pdf_json.get("document", {}).get("format") == "pdf"
                and rest_pdf_json.get("meta", {}).get("converter") == "gotenberg"
                and rest_pdf_file.status == 200
                and rest_pdf_file.body_bytes.startswith(b"%PDF-")
            ),
        }

        simple_payload_pdf = dict(simple_payload_docx)
        simple_payload_pdf["output_format"] = "pdf"
        simple_pdf_req = {
            "action": "simple_generate",
            "nonce": nonce_pdf,
            "data": json.dumps(simple_payload_pdf),
        }
        simple_pdf_res = post_form(AJAX_URL, simple_pdf_req)
        simple_pdf_json = parse_json(simple_pdf_res.body_text)
        simple_pdf_url = ""
        if simple_pdf_json.get("success"):
            data = simple_pdf_json.get("data", {})
            if isinstance(data, dict):
                simple_pdf_url = str(data.get("download_url", ""))
        simple_pdf_file = fetch_binary(simple_pdf_url) if simple_pdf_url else HttpResult(0, {}, "", b"")
        results["tests"]["legacy_simple_generate_pdf"] = {
            "status": simple_pdf_res.status,
            "response": simple_pdf_json,
            "downloadStatus": simple_pdf_file.status,
            "pdfMagic": simple_pdf_file.body_bytes[:5].decode("latin-1", errors="ignore"),
            "pdfBytes": len(simple_pdf_file.body_bytes),
            "pass": bool(
                simple_pdf_res.status == 200
                and simple_pdf_json.get("success") is True
                and isinstance(simple_pdf_json.get("data"), dict)
                and str(simple_pdf_json["data"].get("filename", "")).endswith(".pdf")
                and simple_pdf_file.status == 200
                and simple_pdf_file.body_bytes.startswith(b"%PDF-")
            ),
        }

        # Legacy vs REST compatibility summary
        legacy_data = simple_docx_json.get("data", {}) if isinstance(simple_docx_json, dict) else {}
        rest_doc = rest_key_json.get("document", {}) if isinstance(rest_key_json, dict) else {}
        results["tests"]["legacy_vs_rest_compatibility"] = {
            "legacyFieldsPresent": bool(isinstance(legacy_data, dict) and "filename" in legacy_data and "download_url" in legacy_data),
            "restFieldsPresent": bool(isinstance(rest_doc, dict) and "filename" in rest_doc and "downloadUrl" in rest_doc),
            "legacyHasUseCaseMeta": bool(isinstance(legacy_data, dict) and isinstance(legacy_data.get("meta"), dict) and "templateKey" in legacy_data.get("meta", {})),
            "pass": bool(
                isinstance(legacy_data, dict)
                and isinstance(rest_doc, dict)
                and "filename" in legacy_data
                and "download_url" in legacy_data
                and "filename" in rest_doc
                and "downloadUrl" in rest_doc
            ),
        }

        # Env fallback test for agent key (without option key)
        stop_server(wp_proc)
        wp_proc = None
        configure_wp(agent_key="", converter_url=CONVERTER_URL, converter_token=CONVERTER_TOKEN)
        wp_proc, wp_log = start_wp_server(extra_env={"TOP_INSTAL_AGENT_API_KEY": "env-agent-key-777"})
        env_nonce = run_php("""<?php require_once __DIR__ . '/wp-load.php'; echo wp_create_nonce('top_instal_nonce'); ?>""").strip()
        env_req = post_json(
            REST_URL,
            build_rest_payload(first_kit, "docx", "trace-env-key"),
            headers={"X-Top-Instal-Agent-Key": "env-agent-key-777"},
        )
        env_json = parse_json(env_req.body_text)
        env_bad_req = post_json(
            REST_URL,
            build_rest_payload(first_kit, "docx", "trace-env-key-bad"),
            headers={"X-Top-Instal-Agent-Key": "rotated-agent-key-456"},
        )
        env_bad_json = parse_json(env_bad_req.body_text)
        results["tests"]["agent_key_env_fallback"] = {
            "nonce": env_nonce,
            "envGoodStatus": env_req.status,
            "envGoodResponse": env_json,
            "envBadStatus": env_bad_req.status,
            "envBadResponse": env_bad_json,
            "pass": bool(env_req.status == 200 and env_json.get("status") == "success" and env_bad_req.status == 403),
        }

        # Read path verification for option key in runtime
        option_read_out = run_php("""<?php
require_once __DIR__ . '/wp-load.php';
$c = new TopInstal_Generator_Config_Wp();
echo 'OPTION=' . get_option('top_instal_agent_api_key', '') . "\\n";
echo 'READ=' . $c->get_agent_api_key() . "\\n";
?>""", extra_env={"TOP_INSTAL_AGENT_API_KEY": "env-agent-key-777"})
        results["tests"]["agent_key_read_path"] = {
            "output": option_read_out,
            "pass": "READ=env-agent-key-777" in option_read_out,
        }

        # Pull debug log for converter call evidence
        curl_debug_path = WP_ROOT / "wp-content/plugins/top-instal-generator/curl_debug.txt"
        if curl_debug_path.exists():
            results["converterDebugLog"] = curl_debug_path.read_text(encoding="utf-8", errors="replace")

    finally:
        if converter_server:
            converter_server.shutdown()
        stop_server(wp_proc)

    DOCS_DIR.mkdir(parents=True, exist_ok=True)
    out_json = DOCS_DIR / "RUNTIME_E2E_RESULTS.json"
    out_json.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"RESULTS_JSON={out_json}")

    failed = [name for name, data in results.get("tests", {}).items() if isinstance(data, dict) and data.get("pass") is False]
    print("FAILED_TESTS=" + ",".join(failed))
    if failed:
        sys.exit(2)


if __name__ == "__main__":
    main()
