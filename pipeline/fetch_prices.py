#!/usr/bin/env python3
"""סוכר בסל - daily price refresh.

Pulls PriceFull files (חוק שקיפות המחירים) for the catalog barcodes and
rewrites docs/data/prices.json. The rating catalog itself is static curation.
"""
import datetime as dt, glob, json, os, sys, xml.etree.ElementTree as ET

CHAINS = {
    "shufersal":  {"scraper": "SHUFERSAL", "store_id": 413, "name_he": "שופרסל"},
    "rami_levy":  {"scraper": "RAMI_LEVY", "store_id": 1,   "name_he": "רמי לוי"},
    "carrefour":  {"scraper": "YAYNO_BITAN_AND_CARREFOUR", "store_id": 471, "name_he": "Carrefour"},
    "yochananof": {"scraper": "YOHANANOF", "store_id": 1,   "name_he": "יוחננוף"},
    "osher_ad":   {"scraper": "OSHER_AD",  "store_id": 1,   "name_he": "אושר עד"},
    "tiv_taam":   {"scraper": "TIV_TAAM",  "store_id": 2,   "name_he": "טיב טעם"},
}
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BARCODES = os.path.join(ROOT, "pipeline", "barcodes.json")

def load_xml(path, wanted):
    out = {}
    for _ev, el in ET.iterparse(path, events=("end",)):
        if el.tag != "Item": continue
        code = (el.findtext("ItemCode") or "").strip()
        if code in wanted:
            try: out[code] = float((el.findtext("ItemPrice") or "0").strip())
            except ValueError: pass
        el.clear()
    return out

def newest_xml(folder):
    fs = sorted(glob.glob(os.path.join(folder, "**", "*PriceFull*.xml"), recursive=True))
    return fs[-1] if fs else None

async def scrape(key, cfg, workdir):
    from il_supermarket_scarper.scrappers_factory import ScraperFactory
    from il_supermarket_scarper.utils.file_types import FileTypesFilters
    from il_supermarket_scarper.utils.file_output import DiskFileOutput
    cls = ScraperFactory.get(cfg["scraper"])
    inst = cls(file_output=DiskFileOutput(storage_path=os.path.join(workdir, key)))
    async for e in inst.scrape(limit=1, store_id=cfg["store_id"], files_types=[FileTypesFilters.PRICE_FULL_FILE.name]):
        print(key, "->", e.file_name, e.downloaded, e.error, flush=True)

def main():
    import asyncio
    today = dt.date.today().isoformat()
    catalog = json.load(open(os.path.join(ROOT, "pipeline", "barcodes.json")))
    id_by_bc = {e["barcode"]: e["id"] for e in catalog}
    wanted = set(id_by_bc)
    workdir = os.path.join(ROOT, ".work"); os.makedirs(workdir, exist_ok=True)
    names = json.load(open(os.path.join(ROOT, "docs", "data", "prices.json")))["items"]
    name_by_bc = {e["barcode"]: e["name_he"] for e in names}

    if os.environ.get("OFFLINE_DIR"):
        xml_paths = {k: newest_xml(os.path.join(os.environ["OFFLINE_DIR"], k)) for k in CHAINS}
    else:
        for k, cfg in CHAINS.items():
            try:
                asyncio.run(scrape(k, cfg, workdir))
            except Exception as ex:
                print(k, "scrape failed:", ex, file=sys.stderr)
        xml_paths = {k: newest_xml(os.path.join(workdir, k)) for k in CHAINS}

    ok = {k: p for k, p in xml_paths.items() if p}
    if len(ok) < 3:
        print("too few chains succeeded:", list(ok), file=sys.stderr); sys.exit(1)
    print("chains today:", list(ok))

    items = []
    for bc, iid in id_by_bc.items():
        prices = {}
        for k, p in ok.items():
            for code, price in load_xml(p, {bc}).items():
                if price > 0: prices[k] = round(price, 2)
        if prices:
            items.append({"id": iid, "name_he": name_by_bc.get(bc, bc), "barcode": bc, "prices": prices})
    snap = {"date": today, "items": items}
    os.makedirs(os.path.join(ROOT, "data"), exist_ok=True)
    json.dump(snap, open(os.path.join(ROOT, "data", f"prices-{today}.json"), "w"), ensure_ascii=False, indent=1)
    json.dump(snap, open(os.path.join(ROOT, "docs", "data", "prices.json"), "w"), ensure_ascii=False)
    print("wrote", len(items), "items for", today)

if __name__ == "__main__":
    main()
