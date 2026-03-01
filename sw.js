// Push bildirimleri kısmında:
const options = {
    body: event.data.text(),
    icon: 'icon.png',  // Burayı güncelledik
    badge: 'icon.png', // Aynı ikonu badge olarak da kullan
    vibrate: [200, 100, 200],
    data: {
        dateOfArrival: Date.now(),
        primaryKey: 1
    }
};
