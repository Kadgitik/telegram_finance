from aiogram.fsm.state import State, StatesGroup


class PendingTx(StatesGroup):
    waiting_expense_category = State()
    waiting_income_category = State()
