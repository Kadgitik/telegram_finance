import asyncio
import re
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    client = AsyncIOMotorClient("mongodb+srv://financebot:Knd0iG5e4fM8nL8R@cluster0.b73x2.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0")
    db = client["finance"]
    
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
    client.close()

if __name__ == "__main__":
    asyncio.run(main())
