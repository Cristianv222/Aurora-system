import json
from channels.generic.websocket import AsyncWebsocketConsumer

class InvoiceConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.reservation_id = self.scope['url_route']['kwargs']['reservation_id']
        self.group_name = f"invoice_status_{self.reservation_id}"

        # Join group
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )

        await self.accept()

    async def disconnect(self, close_code):
        # Leave group
        await self.channel_layer.group_discard(
            self.group_name,
            self.channel_name
        )

    # Receive message from room group
    async def invoice_status_update(self, event):
        status = event['status']
        message = event['message']

        # Send message to WebSocket
        await self.send(text_data=json.dumps({
            'status': status,
            'message': message
        }))
