import { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

export default function CertificateButton({ courseName, userName }) {
    const [loading, setLoading] = useState(false);

    const downloadCertificate = async () => {
        try {
            if (!userName || userName.trim() === '') {
                toast.error('User name is required');
                return;
            }
            setLoading(true);
            const response = await axios({
                url: `${import.meta.env.VITE_BACKEND_HOST_URL}/api/certificate/generate`,
                method: 'POST',
                responseType: 'blob',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                },
                data: {
                    name: userName.trim(),
                    course: courseName,
                    date: new Date().toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    })
                }
            });

            // If response is a PDF, download it
            const contentType = response.headers['content-type'];
            if (contentType && contentType.includes('application/pdf')) {
                const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', `certificate.pdf`);
                document.body.appendChild(link);
                link.click();
                link.remove();
                window.URL.revokeObjectURL(url);
                toast.success('Certificate downloaded!');
            } else {
                // Try to parse error from blob
                const text = await response.data.text();
                let errorMsg = 'Certificate generation failed';
                try {
                    const errJson = JSON.parse(text);
                    errorMsg = errJson.details || errJson.error || errorMsg;
                } catch {
                    // Intentionally left blank: fallback to default error message
                }
                throw new Error(errorMsg);
            }
        } catch (error) {
            let msg = error.message || 'Download failed';
            if (error.response && error.response.data) {
                try {
                    const reader = new FileReader();
                    reader.onload = () => {
                        try {
                            const errJson = JSON.parse(reader.result);
                            msg = errJson.details || errJson.error || msg;
                            toast.error('Download failed: ' + msg);
                        } catch {
                            toast.error('Download failed: ' + msg);
                        }
                    };
                    reader.readAsText(error.response.data);
                    return;
                } catch {
                    // Intentionally left blank: fallback to default error message
                }
            }
            toast.error('Download failed: ' + msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={downloadCertificate}
            disabled={loading}
            className="w-full bg-gov-accent-500 text-white py-3 px-4 rounded-lg 
                font-semibold transition-all duration-300
                hover:bg-gov-accent-400 hover:shadow-lg hover:shadow-gov-accent-500/20 
                disabled:opacity-50 disabled:cursor-not-allowed
                hover:translate-y-[-2px] active:translate-y-0"
        >
            {loading ? (
                <div className="flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Generating...
                </div>
            ) : (
                'Download Certificate'
            )}
        </button>
    );
}
