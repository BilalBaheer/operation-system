// Saves each event to the outbox_events table.
// In Azure, a small relay job reads unpublished rows and sends them to Service Bus,
// so an event is never lost even if Service Bus is briefly unavailable.
function createOutboxPublisher(pool) {
  return {
    async publish(event) {
      await pool.query(
        'INSERT INTO outbox_events (event_type, payload) VALUES ($1, $2)',
        [event.type, JSON.stringify(event)]
      );
    },
  };
}

module.exports = { createOutboxPublisher };
