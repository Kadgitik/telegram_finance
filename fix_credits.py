import asyncio
import re
from motor.motor_asyncio import AsyncIOMotorClient

async def fix():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["telegram_finance"]
    rx = re.compile(r"кредит до завтра|погашення кредит|кредит до зарплати|відсотки за|погашення заборгованості", re.IGNORECASE)
    
    docs = await db["transactions"].find({}).to_list(None)
    fixed = 0
    for d in docs:
        desc = d.get("description", "")
        if rx.search(desc) and d.get("category") != "Кредит":
            await db["transactions"].update_one(
                {"_id": d["_id"]},
                {"$set": {"category": "Кредит", "internal_transfer": False}}
            )
            fixed += 1
    print(f"Fixed {fixed} transactions.")

if __name__ == "__main__":
    asyncio.run(fix())
