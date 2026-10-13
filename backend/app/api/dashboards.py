from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def list_dashboards():
    pass

@router.post("/")
async def create_dashboard():
    pass

@router.get("/{id}")
async def get_dashboard(id: str):
    pass

@router.put("/{id}")
async def update_dashboard(id: str):
    pass

@router.delete("/{id}")
async def delete_dashboard(id: str):
    pass

@router.post("/{id}/widgets")
async def add_widget(id: str):
    pass

@router.put("/{id}/widgets/{widget_id}")
async def update_widget(id: str, widget_id: str):
    pass

@router.delete("/{id}/widgets/{widget_id}")
async def delete_widget(id: str, widget_id: str):
    pass

@router.post("/{id}/duplicate")
async def duplicate_dashboard(id: str):
    pass
