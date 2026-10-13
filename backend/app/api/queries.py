from fastapi import APIRouter

router = APIRouter()

@router.post("/execute")
async def execute_query():
    pass

@router.post("/preview")
async def preview_query():
    pass

@router.get("/")
async def list_queries():
    pass

@router.post("/")
async def save_query():
    pass

@router.delete("/{id}")
async def delete_query(id: str):
    pass
