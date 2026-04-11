import asyncio
import re
from datetime import datetime, timezone
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
from bot.db.mongo import get_client, get_db

async def main():
    db = get_db()
    rx = re.compile(r"^(З|Зі|На)\s+.*(картки|картку|банки|банку|рахунку)$|^Переказ на картку$|^Поповнення картки$", re.IGNORECASE)
    
    docs = await db["transactions"].find({"source": "monobank"}).to_list(None)
    updates = 0
    for d in docs:
        desc = d.get("description", "").strip()
        if rx.search(desc) and not d.get("internal_transfer"):
            await db["transactions"].update_one(
                {"_id": d["_id"]},
                {"$set": {"internal_transfer": True}}
            )
            updates += 1
            
    print(f"Updated {updates} transactions retroactively.")
    
    client = get_client()
    client.close()

if __name__ == "__main__":
    asyncio.run(main())
