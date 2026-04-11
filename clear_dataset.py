"""Clear all transactions from the database so user can re-import from Monobank.

Preserves: users, goals, savings
Clears: transactions collection

Usage: python clear_dataset.py
"""
import asyncio
import os
import sys

# Ensure project root is on path
sys.path.insert(0, os.path.dirname(__file__))

from bot.db.mongo import get_client, get_db, close_client


async def main():
    get_client()
    db = get_db()

    # Count before
    count = await db["transactions"].count_documents({})
    print(f"Found {count} transactions in database.")

    if count == 0:
        print("Nothing to clear.")
        await close_client()
        return

    confirm = input(f"Delete ALL {count} transactions? (yes/no): ").strip().lower()
    if confirm != "yes":
        print("Cancelled.")
        await close_client()
        return

    result = await db["transactions"].delete_many({})
    print(f"Deleted {result.deleted_count} transactions.")

    # Verify
    remaining = await db["transactions"].count_documents({})
    print(f"Remaining transactions: {remaining}")
    
    # Show what's preserved
    users = await db["users"].count_documents({})
    goals = await db["goals"].count_documents({})
    savings = await db["savings"].count_documents({})
    print(f"\nPreserved: {users} users, {goals} goals, {savings} savings entries")
    print("Done! You can now re-sync from Monobank.")

    await close_client()


if __name__ == "__main__":
    asyncio.run(main())
